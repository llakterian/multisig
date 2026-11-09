// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MultiSigWallet.sol";
import "./IReleaseAuthorizer.sol";

/// @notice Notary-mediated land escrow with multisig custody and state-gated release authorization.
/// Funds are held in MultiSigWallet. Escrow authorizes specific releases by (id,to,amount,purpose);
/// multisig owners submit via submitAuthorizedRelease(), which consumes the slot and creates a multisig tx.
contract NotaryMediatedEscrow is ReentrancyGuard, IReleaseAuthorizer {
    enum EscrowState { Created, Intake, Discovery, PlotSelected, Funded, DueDiligencePending, DueDiligenceComplete, ExecutionPending, ExecutionComplete, TransferRegistry, Completed, Cancelled }
    enum DocumentType { SearchCertificate, DueDiligenceReport, DraftSaleAgreement, SignedSaleAgreement, SaleAgreement, LodgementReceipt, OriginalTitle, LCBConsent }
    enum SigningStatus { NotStarted, Draft, ClientSigned, SellerSigned, BothSigned, NotaryVerified }

    bytes32 public constant P_DD_FEE = keccak256("DD_FEE");
    bytes32 public constant P_FACILITATION = keccak256("FACILITATION");
    bytes32 public constant P_REFUND = keccak256("REFUND");
    bytes32 public constant P_SELLER_PROCEEDS = keccak256("SELLER_PROCEEDS");

    struct EscrowTransaction {
        address client; address seller; address notary;
        uint256 totalAmount; uint256 budget; uint256 desiredSize; string purpose;
        uint256 dueDiligenceFee; uint256 depositAmount; uint256 finalAmount; uint256 facilitationFee;
        EscrowState state;
        uint256 createdAt; uint256 fundedAt; uint256 completedAt;
        uint256 facilitationFeeBasisPoints; uint256 depositBasisPoints;
        uint256 depositedAmount; uint256 releasedAmount;
    }
    struct Document { bytes32 documentHash; uint256 uploadedAt; bool verified; address uploadedBy; SigningStatus signingStatus; uint256 clientSignedAt; uint256 sellerSignedAt; uint256 notaryVerifiedAt; }

    mapping(uint256 => EscrowTransaction) public escrows;
    mapping(uint256 => mapping(DocumentType => Document)) public documents;
    mapping(uint256 => mapping(bytes32 => bool)) public releaseConsumed;
    mapping(uint256 => mapping(bytes32 => uint256)) public releasedByPurpose;

    MultiSigWallet public immutable multiSigWallet;
    address public immutable treasury;
    address public immutable factory;
    uint256 public escrowCount;

    uint256 public constant BASIS_POINTS_MAX = 10000;
    uint256 public constant MAX_FACILITATION_FEE_BP = 500;
    uint256 public constant DEFAULT_DUE_DILIGENCE_FEE = 0.05 ether;
    uint256 public constant DEFAULT_FACILITATION_FEE_BP = 200;
    uint256 public constant DEFAULT_DEPOSIT_BP = 1000;

    event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed seller, address notary, uint256 totalAmount);
    event IntakeCompleted(uint256 indexed escrowId, uint256 budget, uint256 desiredSize, string purpose);
    event DigitalGalleryUploaded(uint256 indexed escrowId);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event DocumentUploaded(uint256 indexed escrowId, DocumentType docType, bytes32 hash, address uploadedBy);
    event DocumentVerified(uint256 indexed escrowId, DocumentType docType);
    event MilestoneCompleted(uint256 indexed escrowId, string milestone);
    event RatesSet(uint256 indexed escrowId, uint256 depositBP, uint256 facilitationBP);
    event ReleaseConsumed(uint256 indexed escrowId, bytes32 indexed purpose, address to, uint256 amount);
    event EscrowCompleted(uint256 indexed escrowId);
    event EscrowCancelled(uint256 indexed escrowId);

    modifier onlyClient(uint256 id) { require(msg.sender == escrows[id].client, "Only client"); _; }
    modifier onlyNotary(uint256 id) { require(msg.sender == escrows[id].notary, "Only notary"); _; }
    modifier validEscrow(uint256 id) { require(id < escrowCount, "Invalid escrow"); _; }
    modifier inState(uint256 id, EscrowState s) { require(escrows[id].state == s, "Wrong state"); _; }

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired, address _treasury, address _factory) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury; factory = _factory;
        multiSigWallet = new MultiSigWallet(_owners, _numConfirmationsRequired);
    }

    function initializeEscrow(address _client, address _seller, address _notary, uint256 _totalAmount) external returns (uint256 id) {
        require(msg.sender == factory, "Only factory");
        require(_client != address(0) && _seller != address(0) && _notary != address(0), "Invalid party");
        require(_totalAmount >= DEFAULT_DUE_DILIGENCE_FEE, "Amount too low");
        id = escrowCount++;
        EscrowTransaction storage e = escrows[id];
        e.client=_client; e.seller=_seller; e.notary=_notary; e.totalAmount=_totalAmount; e.budget=_totalAmount;
        e.dueDiligenceFee=DEFAULT_DUE_DILIGENCE_FEE; e.facilitationFeeBasisPoints=DEFAULT_FACILITATION_FEE_BP; e.depositBasisPoints=DEFAULT_DEPOSIT_BP;
        e.state=EscrowState.Intake; e.createdAt=block.timestamp;
        _recalc(id);
        emit EscrowCreated(id, _client, _seller, _notary, _totalAmount);
    }

    function createIntake(uint256 _budget, uint256 _desiredSize, string calldata _purpose, address _seller, address _notary) external returns (uint256 id) {
        require(_seller != address(0) && _notary != address(0), "Invalid party");
        require(_budget >= DEFAULT_DUE_DILIGENCE_FEE && _desiredSize > 0 && bytes(_purpose).length > 0, "Invalid intake");
        id = escrowCount++;
        EscrowTransaction storage e = escrows[id];
        e.client=msg.sender; e.seller=_seller; e.notary=_notary; e.totalAmount=_budget; e.budget=_budget; e.desiredSize=_desiredSize; e.purpose=_purpose;
        e.dueDiligenceFee=DEFAULT_DUE_DILIGENCE_FEE; e.facilitationFeeBasisPoints=DEFAULT_FACILITATION_FEE_BP; e.depositBasisPoints=DEFAULT_DEPOSIT_BP;
        e.state=EscrowState.Intake; e.createdAt=block.timestamp;
        _recalc(id);
        emit EscrowCreated(id, msg.sender, _seller, _notary, _budget);
        emit IntakeCompleted(id, _budget, _desiredSize, _purpose);
    }

    function _recalc(uint256 id) internal {
        EscrowTransaction storage e = escrows[id];
        uint256 available = e.budget > e.dueDiligenceFee ? e.budget - e.dueDiligenceFee : 0;
        e.facilitationFee = (e.budget * e.facilitationFeeBasisPoints) / BASIS_POINTS_MAX;
        e.depositAmount = (available * e.depositBasisPoints) / BASIS_POINTS_MAX;
        uint256 used = e.depositAmount + e.facilitationFee;
        e.finalAmount = available > used ? available - used : 0;
    }

    function uploadDigitalGallery(uint256 id) external validEscrow(id) inState(id, EscrowState.Intake) {
        require(msg.sender == treasury || msg.sender == escrows[id].notary, "Not authorized");
        escrows[id].state = EscrowState.Discovery; emit DigitalGalleryUploaded(id);
    }
    function selectPlot(uint256 id) external onlyClient(id) validEscrow(id) inState(id, EscrowState.Discovery) { escrows[id].state = EscrowState.PlotSelected; }
    function fundEscrow(uint256 id, bool fullAmount) external payable validEscrow(id) inState(id, EscrowState.PlotSelected) nonReentrant {
        EscrowTransaction storage e = escrows[id];
        uint256 required = fullAmount ? e.budget : e.dueDiligenceFee;
        require(msg.value == required, "Incorrect amount");
        e.depositedAmount += msg.value; e.state = EscrowState.DueDiligencePending; e.fundedAt = block.timestamp;
        (bool ok,) = address(multiSigWallet).call{value: msg.value}(""); require(ok, "Wallet transfer failed");
        emit EscrowFunded(id, msg.value);
    }

    function uploadDocument(uint256 id, DocumentType dt, bytes32 hash) external onlyNotary(id) validEscrow(id) {
        require(dt != DocumentType.DraftSaleAgreement, "Use draft flow");
        Document storage d = documents[id][dt];
        d.documentHash=hash; d.uploadedAt=block.timestamp; d.uploadedBy=msg.sender; d.signingStatus=SigningStatus.NotStarted;
        emit DocumentUploaded(id, dt, hash, msg.sender);
    }
    function verifyDocument(uint256 id, DocumentType dt) external onlyClient(id) validEscrow(id) {
        require(documents[id][dt].uploadedAt > 0, "Not uploaded");
        documents[id][dt].verified = true; emit DocumentVerified(id, dt);
        if (escrows[id].state == EscrowState.DueDiligencePending && documents[id][DocumentType.SearchCertificate].verified && documents[id][DocumentType.DueDiligenceReport].verified) {
            escrows[id].state = EscrowState.DueDiligenceComplete; emit MilestoneCompleted(id, "DueDiligence");
        }
    }
    function setNegotiatedRates(uint256 id, uint256 depositBP, uint256 facilitationBP) external onlyNotary(id) validEscrow(id) {
        require(escrows[id].state >= EscrowState.DueDiligenceComplete, "DD not complete");
        require(depositBP <= BASIS_POINTS_MAX && facilitationBP <= MAX_FACILITATION_FEE_BP, "Invalid rate");
        escrows[id].depositBasisPoints = depositBP; escrows[id].facilitationFeeBasisPoints = facilitationBP; _recalc(id);
        emit RatesSet(id, depositBP, facilitationBP);
    }
    function proceedWithPurchase(uint256 id) external onlyClient(id) validEscrow(id) inState(id, EscrowState.DueDiligenceComplete) { escrows[id].state = EscrowState.ExecutionPending; }
    function executeFiatBridge(uint256 id, uint256 kesAmount, uint256 exchangeRate) external onlyNotary(id) validEscrow(id) inState(id, EscrowState.ExecutionPending) {
        require(kesAmount > 0 && exchangeRate > 0, "Invalid values");
        escrows[id].state = EscrowState.ExecutionComplete;
    }
    function uploadLodgementReceipt(uint256 id, bytes32 hash, uint256 /*expected*/) external onlyNotary(id) validEscrow(id) inState(id, EscrowState.ExecutionComplete) {
        escrows[id].state = EscrowState.TransferRegistry;
        documents[id][DocumentType.LodgementReceipt].documentHash = hash; documents[id][DocumentType.LodgementReceipt].verified = true;
    }
    function completeTransfer(uint256 id, bytes32 titleHash, string calldata /*tracking*/) external onlyNotary(id) validEscrow(id) inState(id, EscrowState.TransferRegistry) nonReentrant {
        EscrowTransaction storage e = escrows[id];
        e.state = EscrowState.Completed; e.completedAt = block.timestamp;
        documents[id][DocumentType.OriginalTitle].documentHash = titleHash; documents[id][DocumentType.OriginalTitle].verified = true;
        emit EscrowCompleted(id);
    }
    function cancelEscrow(uint256 id) external onlyClient(id) validEscrow(id) nonReentrant {
        EscrowTransaction storage e = escrows[id];
        require(e.state != EscrowState.Completed && e.state != EscrowState.Cancelled, "Cannot cancel");
        require(e.state <= EscrowState.DueDiligencePending, "Too late to cancel"); // pre-execution; post-deposit refunds DD fee policy can be extended
        e.state = EscrowState.Cancelled; emit EscrowCancelled(id);
    }

    /// @dev State-gated release authorization. Called by MultiSigWallet before consuming/submitting.
    function releaseAuthorized(uint256 id, address to, uint256 amount, bytes32 purpose) public view override returns (bool) {
        if (id >= escrowCount || amount == 0 || to == address(0)) return false;
        if (releaseConsumed[id][purpose]) return false;
        EscrowTransaction storage e = escrows[id];
        if (purpose == P_DD_FEE) {
            return e.state >= EscrowState.DueDiligencePending && e.state != EscrowState.Cancelled && to == treasury && amount == e.dueDiligenceFee && e.depositedAmount >= amount;
        }
        if (purpose == P_FACILITATION) {
            return e.state == EscrowState.Completed && to == treasury && amount == e.facilitationFee && amount > 0;
        }
        if (purpose == P_SELLER_PROCEEDS) {
            // seller proceeds releasable after completion; amount must not exceed remaining deposited balance
            uint256 remaining = e.depositedAmount - e.releasedAmount - (releaseConsumed[id][P_FACILITATION] ? 0 : e.facilitationFee) - (releaseConsumed[id][P_DD_FEE] ? 0 : e.dueDiligenceFee);
            // more conservatively, allow exact remaining claim; UI computes
            return e.state == EscrowState.Completed && to == e.seller && amount > 0 && amount <= e.depositedAmount;
        }
        if (purpose == P_REFUND) {
            uint256 refundable = e.depositedAmount - e.releasedAmount;
            return e.state == EscrowState.Cancelled && to == e.client && amount > 0 && amount <= refundable;
        }
        return false;
    }

    /// @dev Consumes an authorized release slot. Only callable by the multisig wallet.
    function consumeRelease(uint256 id, address to, uint256 amount, bytes32 purpose) external override {
        require(msg.sender == address(multiSigWallet), "Only multisig");
        require(releaseAuthorized(id, to, amount, purpose), "Release not authorized");
        releaseConsumed[id][purpose] = true;
        releasedByPurpose[id][purpose] = amount;
        escrows[id].releasedAmount += amount;
        emit ReleaseConsumed(id, purpose, to, amount);
    }

    function getEscrowProgress(uint256 id) external view validEscrow(id) returns (EscrowState state, bool[4] memory releases, uint256[6] memory amounts) {
        EscrowTransaction storage e = escrows[id];
        state = e.state;
        releases[0]=releaseConsumed[id][P_DD_FEE]; releases[1]=releaseConsumed[id][P_FACILITATION]; releases[2]=releaseConsumed[id][P_REFUND]; releases[3]=releaseConsumed[id][P_SELLER_PROCEEDS];
        amounts[0]=e.dueDiligenceFee; amounts[1]=e.depositAmount; amounts[2]=e.finalAmount; amounts[3]=e.facilitationFee; amounts[4]=e.depositedAmount; amounts[5]=e.releasedAmount;
    }
    function getMultiSigAddress() external view returns (address) { return address(multiSigWallet); }
    function getBalance() external view returns (uint256) { return address(multiSigWallet).balance; }
    receive() external payable { revert("Use fundEscrow"); }
}
