// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MultiSigWallet.sol";

contract NotaryMediatedEscrow is ReentrancyGuard {
    
    enum EscrowState { 
        Created, 
        Intake, 
        Discovery, 
        PlotSelected,
        Funded, 
        DueDiligencePending, 
        DueDiligenceComplete, 
        ExecutionPending, 
        ExecutionComplete, 
        TransferRegistry,
        Completed, 
        Cancelled 
    }
    
    enum Milestone { 
        DueDiligence,
        Deposit,
        FinalSettlement
    }
    
    enum DocumentType { 
        SearchCertificate,
        DueDiligenceReport,
        DraftSaleAgreement,
        SignedSaleAgreement,
        SaleAgreement,
        LodgementReceipt, 
        OriginalTitle, 
        LCBConsent
    }
    
    enum SigningStatus { 
        NotStarted, 
        Draft, 
        ClientSigned, 
        SellerSigned, 
        BothSigned, 
        NotaryVerified 
    }
    
    struct EscrowTransaction {
        address client;
        address seller;
        address notary;
        uint totalAmount;
        uint budget;
        uint desiredSize;
        string purpose;
        uint dueDiligenceFee;
        uint depositAmount;
        uint finalAmount;
        uint facilitationFee;
        uint sellerKESAmount;
        uint exchangeRate;
        EscrowState state;
        uint createdAt;
        uint fundedAt;
        uint completedAt;
        uint expectedCompletionDate;
        string courierTracking;
        bool documentsSecured;
        uint facilitationFeeBasisPoints;
        uint depositBasisPoints;
        uint depositedAmount;
        bool facilitationFeeReleased;
    }
    
    struct Document {
        bytes32 documentHash;
        uint uploadedAt;
        bool verified;
        address uploadedBy;
        SigningStatus signingStatus;
        mapping(address => bool) hasSigned;
        uint clientSignedAt;
        uint sellerSignedAt;
        uint notaryVerifiedAt;
    }
    
    mapping(uint => EscrowTransaction) public escrows;
    mapping(uint => mapping(Milestone => bool)) public milestoneCompleted;
    mapping(uint => mapping(DocumentType => Document)) public documents;
    mapping(uint => mapping(address => bool)) public partyNotifications;
    
    MultiSigWallet public multiSigWallet;
    
    event EscrowCreated(uint indexed escrowId, address indexed client, address indexed seller, address notary, uint totalAmount, uint desiredSize, string purpose);
    event IntakeCompleted(uint indexed escrowId, uint budget, uint desiredSize, string purpose);
    event DigitalGalleryUploaded(uint indexed escrowId, string[] geoPins, string[] photos, string[] videos);
    event EscrowFunded(uint indexed escrowId, uint amount, uint immediateRelease);
    event MilestoneCompleted(uint indexed escrowId, Milestone milestone);
    event DocumentUploaded(uint indexed escrowId, DocumentType docType, bytes32 hash, address uploadedBy);
    event DocumentVerified(uint indexed escrowId, DocumentType docType);
    event DueDiligenceReportUploaded(uint indexed escrowId, bytes32 reportHash);
    event FiatBridgeExecuted(uint indexed escrowId, uint cryptoAmount, uint kesAmount, uint exchangeRate);
    event FundsDisbursedToSeller(uint indexed escrowId, uint kesAmount);
    event DocumentsSecured(uint indexed escrowId, string documentTypes);
    event LodgementReceiptUploaded(uint indexed escrowId, bytes32 receiptHash, uint expectedCompletionDate);
    event TitleIssued(uint indexed escrowId, bytes32 titleHash, string courierTracking);
    event FundsReleased(uint indexed escrowId, Milestone milestone, address recipient, uint amount);
    event EscrowCompleted(uint indexed escrowId);
    event EscrowCancelled(uint indexed escrowId);
    event DraftAgreementUploaded(uint indexed escrowId, bytes32 hash, address uploadedBy);
    event DocumentSigned(uint indexed escrowId, DocumentType docType, address signer, string signerRole);
    event BothPartiesSigned(uint indexed escrowId, DocumentType docType);
    event NotaryVerifiedSignedDocument(uint indexed escrowId, DocumentType docType);
    event PartyNotified(uint indexed escrowId, address party, string message);
    event PlotSelected(uint indexed escrowId, address indexed client);
    event ProceededWithPurchase(uint indexed escrowId, address indexed client);
    
    uint public constant BASIS_POINTS_MAX = 10000;
    uint public constant MAX_FACILITATION_FEE_BP = 500;
    uint public constant DEFAULT_DUE_DILIGENCE_FEE = 0.05 ether;
    uint public constant DEFAULT_FACILITATION_FEE_PERCENT = 200;
    uint public constant DEFAULT_DEPOSIT_PERCENT = 1000;
    
    uint public escrowCount;
    address public immutable sizlandTreasury;
    
    modifier onlyClient(uint _escrowId) {
        require(msg.sender == escrows[_escrowId].client, "Only client can call this");
        _;
    }
    
    modifier onlyNotary(uint _escrowId) {
        require(msg.sender == escrows[_escrowId].notary, "Only notary can call this");
        _;
    }
    
    modifier onlyMultiSigOwner() {
        require(multiSigWallet.isOwner(msg.sender), "Only multi-sig owner");
        _;
    }
    
    modifier validEscrow(uint _escrowId) {
        require(_escrowId < escrowCount, "Invalid escrow ID");
        _;
    }
    
    modifier escrowState(uint _escrowId, EscrowState _requiredState) {
        require(escrows[_escrowId].state == _requiredState, "Invalid escrow state");
        _;
    }
    
    constructor(
        address[] memory _owners,
        uint _numConfirmationsRequired,
        address _sizlandTreasury
    ) {
        require(_sizlandTreasury != address(0), "Invalid treasury address");
        require(_owners.length > 0, "Owners required");
        
        sizlandTreasury = _sizlandTreasury;
        multiSigWallet = new MultiSigWallet(_owners, _numConfirmationsRequired);
        multiSigWallet.setTrustedCaller(address(this));
    }
    
    function createIntake(
        uint _budget,
        uint _desiredSize,
        string calldata _purpose,
        address _seller,
        address _notary
    ) external returns (uint escrowId) {
        require(_seller != address(0), "Invalid seller address");
        require(_notary != address(0), "Invalid notary address");
        require(_budget >= DEFAULT_DUE_DILIGENCE_FEE, "Budget too low");
        require(_desiredSize > 0, "Invalid size");
        require(bytes(_purpose).length > 0, "Purpose required");
        
        escrowId = escrowCount++;
        
        escrows[escrowId] = EscrowTransaction({
            client: msg.sender,
            seller: _seller,
            notary: _notary,
            totalAmount: _budget,
            budget: _budget,
            desiredSize: _desiredSize,
            purpose: _purpose,
            dueDiligenceFee: DEFAULT_DUE_DILIGENCE_FEE,
            depositAmount: 0,
            finalAmount: 0,
            facilitationFee: 0,
            sellerKESAmount: 0,
            exchangeRate: 0,
            state: EscrowState.Intake,
            createdAt: block.timestamp,
            fundedAt: 0,
            completedAt: 0,
            expectedCompletionDate: 0,
            courierTracking: "",
            documentsSecured: false,
            facilitationFeeBasisPoints: DEFAULT_FACILITATION_FEE_PERCENT,
            depositBasisPoints: DEFAULT_DEPOSIT_PERCENT,
            depositedAmount: 0,
            facilitationFeeReleased: false
        });
        
        emit EscrowCreated(escrowId, msg.sender, _seller, _notary, _budget, _desiredSize, _purpose);
        emit IntakeCompleted(escrowId, _budget, _desiredSize, _purpose);
    }
    
    function uploadDigitalGallery(
        uint _escrowId,
        string[] calldata _geoPins,
        string[] calldata _photos,
        string[] calldata _videos
    ) external validEscrow(_escrowId) {
        require(msg.sender == sizlandTreasury, "Only Sizland admin can upload gallery");
        require(escrows[_escrowId].state == EscrowState.Intake, "Wrong state");
        
        escrows[_escrowId].state = EscrowState.Discovery;
        
        emit DigitalGalleryUploaded(_escrowId, _geoPins, _photos, _videos);
    }
    
    function selectPlot(uint _escrowId) external onlyClient(_escrowId) validEscrow(_escrowId) {
        require(escrows[_escrowId].state == EscrowState.Discovery, "Not in discovery phase");
        escrows[_escrowId].state = EscrowState.PlotSelected;
        emit PlotSelected(_escrowId, msg.sender);
    }
    
    function fundEscrow(uint _escrowId, bool _fullAmount) 
        external 
        payable 
        validEscrow(_escrowId)
        escrowState(_escrowId, EscrowState.PlotSelected)
        nonReentrant
    {
        EscrowTransaction storage escrow = escrows[_escrowId];
        uint requiredAmount = _fullAmount ? escrow.budget : DEFAULT_DUE_DILIGENCE_FEE;
        require(msg.value >= requiredAmount, "Incorrect amount");
        
        // Update state BEFORE external call (Fixes reentrancy vulnerability)
        escrow.depositedAmount += msg.value;
        escrow.state = EscrowState.DueDiligencePending;
        escrow.fundedAt = block.timestamp;
        
        // Perform external call AFTER state updates
        (bool success, ) = address(multiSigWallet).call{value: msg.value}("");
        require(success, "Transfer to multi-sig failed");
        
        emit EscrowFunded(_escrowId, msg.value, DEFAULT_DUE_DILIGENCE_FEE);
    }
    
    function uploadDueDiligenceReport(uint _escrowId, bytes32 _reportHash) 
        external 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
    {
        require(escrows[_escrowId].state == EscrowState.DueDiligencePending, "Wrong state");
        
        Document storage doc = documents[_escrowId][DocumentType.DueDiligenceReport];
        _initializeDocument(doc, _reportHash, msg.sender);
        
        emit DueDiligenceReportUploaded(_escrowId, _reportHash);
        emit DocumentUploaded(_escrowId, DocumentType.DueDiligenceReport, _reportHash, msg.sender);
    }
    
    function uploadDraftAgreement(
        uint _escrowId,
        bytes32 _hash
    ) external validEscrow(_escrowId) {
        EscrowTransaction storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client || msg.sender == escrow.seller, "Only client or seller can upload draft");
        
        Document storage doc = documents[_escrowId][DocumentType.DraftSaleAgreement];
        doc.documentHash = _hash;
        doc.uploadedAt = block.timestamp;
        doc.uploadedBy = msg.sender;
        doc.signingStatus = SigningStatus.Draft;
        
        emit DraftAgreementUploaded(_escrowId, _hash, msg.sender);
        emit DocumentUploaded(_escrowId, DocumentType.DraftSaleAgreement, _hash, msg.sender);
        
        address otherParty = msg.sender == escrow.client ? escrow.seller : escrow.client;
        _notifyParty(_escrowId, otherParty, "Draft sale agreement uploaded for review");
    }
    
    function signDocument(
        uint _escrowId,
        DocumentType _docType
    ) external validEscrow(_escrowId) {
        EscrowTransaction storage escrow = escrows[_escrowId];
        require(_docType == DocumentType.DraftSaleAgreement, "Can only sign draft agreement");
        require(msg.sender == escrow.client || msg.sender == escrow.seller, "Only parties can sign");
        require(!documents[_escrowId][_docType].hasSigned[msg.sender], "Already signed");
        
        Document storage doc = documents[_escrowId][_docType];
        doc.hasSigned[msg.sender] = true;
        
        string memory signerRole = msg.sender == escrow.client ? "Client" : "Seller";
        
        if (msg.sender == escrow.client) {
            doc.clientSignedAt = block.timestamp;
            doc.signingStatus = SigningStatus.ClientSigned;
        } else {
            doc.sellerSignedAt = block.timestamp;
            doc.signingStatus = SigningStatus.SellerSigned;
        }
        
        emit DocumentSigned(_escrowId, _docType, msg.sender, signerRole);
        
        address otherParty = msg.sender == escrow.client ? escrow.seller : escrow.client;
        _notifyParty(_escrowId, otherParty, string(abi.encodePacked(signerRole, " has signed the agreement")));
        
        if (doc.hasSigned[escrow.client] && doc.hasSigned[escrow.seller]) {
            doc.signingStatus = SigningStatus.BothSigned;
            emit BothPartiesSigned(_escrowId, _docType);
            _notifyParty(_escrowId, escrow.notary, "Both parties have signed the agreement - ready for notarization");
        }
    }
    
    function notarizeSignedDocument(
        uint _escrowId,
        DocumentType _docType
    ) external onlyNotary(_escrowId) validEscrow(_escrowId) {
        require(_docType == DocumentType.DraftSaleAgreement, "Can only notarize signed agreement");
        Document storage doc = documents[_escrowId][_docType];
        require(doc.signingStatus == SigningStatus.BothSigned, "Both parties must sign first");
        
        doc.signingStatus = SigningStatus.NotaryVerified;
        doc.notaryVerifiedAt = block.timestamp;
        doc.verified = true;
        
        Document storage signedDoc = documents[_escrowId][DocumentType.SignedSaleAgreement];
        signedDoc.documentHash = doc.documentHash;
        signedDoc.uploadedAt = doc.uploadedAt;
        signedDoc.verified = true;
        signedDoc.uploadedBy = doc.uploadedBy;
        signedDoc.signingStatus = SigningStatus.NotaryVerified;
        signedDoc.clientSignedAt = doc.clientSignedAt;
        signedDoc.sellerSignedAt = doc.sellerSignedAt;
        signedDoc.notaryVerifiedAt = doc.notaryVerifiedAt;
        
        emit NotaryVerifiedSignedDocument(_escrowId, _docType);
        emit DocumentVerified(_escrowId, DocumentType.SignedSaleAgreement);
        
        EscrowTransaction storage escrow = escrows[_escrowId];
        _notifyParty(_escrowId, escrow.client, "Agreement has been notarized - ready for deposit release");
        _notifyParty(_escrowId, escrow.seller, "Agreement has been notarized - ready for deposit release");
    }
    
    function uploadDocument(
        uint _escrowId,
        DocumentType _docType,
        bytes32 _hash
    ) external onlyNotary(_escrowId) validEscrow(_escrowId) {
        require(_docType != DocumentType.DraftSaleAgreement, "Use uploadDraftAgreement for sale agreement");
        
        Document storage doc = documents[_escrowId][_docType];
        doc.documentHash = _hash;
        doc.uploadedAt = block.timestamp;
        doc.uploadedBy = msg.sender;
        doc.verified = false;
        
        emit DocumentUploaded(_escrowId, _docType, _hash, msg.sender);
    }
    
    function _notifyParty(uint _escrowId, address _party, string memory _message) internal {
        partyNotifications[_escrowId][_party] = true;
        emit PartyNotified(_escrowId, _party, _message);
    }
    
    function _initializeDocument(Document storage doc, bytes32 _hash, address _uploader) internal {
        doc.documentHash = _hash;
        doc.uploadedAt = block.timestamp;
        doc.verified = false;
        doc.uploadedBy = _uploader;
        doc.signingStatus = SigningStatus.NotStarted;
        doc.clientSignedAt = 0;
        doc.sellerSignedAt = 0;
        doc.notaryVerifiedAt = 0;
    }
    
    function verifyDocument(
        uint _escrowId,
        DocumentType _docType
    ) external onlyClient(_escrowId) validEscrow(_escrowId) {
        require(documents[_escrowId][_docType].uploadedAt > 0, "Document not uploaded");
        
        documents[_escrowId][_docType].verified = true;
        emit DocumentVerified(_escrowId, _docType);
        
        if (_docType == DocumentType.SearchCertificate && 
            documents[_escrowId][DocumentType.DueDiligenceReport].verified) {
            _completeDueDiligence(_escrowId);
        }
    }
    
    function setNegotiatedRates(
        uint _escrowId, 
        uint _depositBP, 
        uint _facilitationBP
    ) 
        external 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId)
    {
        EscrowTransaction storage escrow = escrows[_escrowId];
        require(escrow.state >= EscrowState.DueDiligenceComplete, "DD not complete");
        require(_depositBP <= BASIS_POINTS_MAX, "Invalid deposit rate");
        require(_facilitationBP <= MAX_FACILITATION_FEE_BP, "Invalid facilitation rate");

        escrow.depositBasisPoints = _depositBP;
        escrow.facilitationFeeBasisPoints = _facilitationBP;

        uint availableForPurchase = escrow.budget - escrow.dueDiligenceFee;
        escrow.facilitationFee = (escrow.budget * _facilitationBP) / BASIS_POINTS_MAX;
        escrow.depositAmount = (availableForPurchase * _depositBP) / BASIS_POINTS_MAX;
        escrow.finalAmount = availableForPurchase - escrow.depositAmount - escrow.facilitationFee;

        emit PartyNotified(_escrowId, escrow.client, "Negotiated rates have been set by the notary");
    }

    function _completeDueDiligence(uint _escrowId) internal {
        EscrowTransaction storage escrow = escrows[_escrowId];
        require(escrow.state == EscrowState.DueDiligencePending, "Wrong state");
        
        milestoneCompleted[_escrowId][Milestone.DueDiligence] = true;
        escrow.state = EscrowState.DueDiligenceComplete;
        
        emit MilestoneCompleted(_escrowId, Milestone.DueDiligence);
    }
    
    function proceedWithPurchase(uint _escrowId) 
        external 
        onlyClient(_escrowId) 
        validEscrow(_escrowId)
        escrowState(_escrowId, EscrowState.DueDiligenceComplete)
    {
        escrows[_escrowId].state = EscrowState.ExecutionPending;
        emit ProceededWithPurchase(_escrowId, msg.sender);
    }
    
    function executeFiatBridge(
        uint _escrowId,
        uint _kesAmount,
        uint _exchangeRate
    ) 
        external 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
        escrowState(_escrowId, EscrowState.ExecutionPending)
        nonReentrant
    {
        require(_kesAmount > 0, "Invalid KES amount");
        require(_exchangeRate > 0, "Invalid exchange rate");
        
        EscrowTransaction storage escrow = escrows[_escrowId];
        escrow.sellerKESAmount = _kesAmount;
        escrow.exchangeRate = _exchangeRate;
        escrow.state = EscrowState.ExecutionComplete;
        escrow.documentsSecured = true;
        
        emit FiatBridgeExecuted(_escrowId, escrow.depositAmount, _kesAmount, _exchangeRate);
        emit FundsDisbursedToSeller(_escrowId, _kesAmount);
        emit DocumentsSecured(_escrowId, "Original Title, Signed Transfers, LCB Consents");
    }
    
    function uploadLodgementReceipt(
        uint _escrowId,
        bytes32 _receiptHash,
        uint _expectedCompletionDate
    ) 
        external 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
        escrowState(_escrowId, EscrowState.ExecutionComplete)
    {
        EscrowTransaction storage escrow = escrows[_escrowId];
        escrow.state = EscrowState.TransferRegistry;
        escrow.expectedCompletionDate = _expectedCompletionDate;
        
        Document storage receiptDoc = documents[_escrowId][DocumentType.LodgementReceipt];
        _initializeDocument(receiptDoc, _receiptHash, msg.sender);
        receiptDoc.verified = true;
        
        emit LodgementReceiptUploaded(_escrowId, _receiptHash, _expectedCompletionDate);
        emit DocumentUploaded(_escrowId, DocumentType.LodgementReceipt, _receiptHash, msg.sender);
    }
    
    function completeTransfer(
        uint _escrowId,
        bytes32 _titleHash,
        string calldata _courierTracking
    ) 
        external 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
        escrowState(_escrowId, EscrowState.TransferRegistry)
        nonReentrant
    {
        EscrowTransaction storage escrow = escrows[_escrowId];
        escrow.state = EscrowState.Completed;
        escrow.courierTracking = _courierTracking;
        escrow.completedAt = block.timestamp;
        
        Document storage titleDoc = documents[_escrowId][DocumentType.OriginalTitle];
        _initializeDocument(titleDoc, _titleHash, msg.sender);
        titleDoc.verified = true;
        
        // Update state BEFORE external call (Fixes reentrancy vulnerability)
        if (!escrow.facilitationFeeReleased && escrow.facilitationFee > 0) {
            escrow.facilitationFeeReleased = true;
            _releaseFunds(_escrowId, sizlandTreasury, escrow.facilitationFee);
        }
        
        emit TitleIssued(_escrowId, _titleHash, _courierTracking);
        emit DocumentUploaded(_escrowId, DocumentType.OriginalTitle, _titleHash, msg.sender);
        emit EscrowCompleted(_escrowId);
    }
    
    function _releaseFunds(uint _escrowId, address _recipient, uint _amount) internal {
        bytes memory data = abi.encode(_escrowId, _recipient);
        multiSigWallet.submitTransaction(_recipient, _amount, data);
        emit FundsReleased(_escrowId, Milestone.FinalSettlement, _recipient, _amount);
    }
    
    receive() external payable {
        // Accept ETH - forward to multi-sig
        (bool success, ) = address(multiSigWallet).call{value: msg.value}("");
        require(success, "Forward to multi-sig failed");
    }
    
    function getEscrowProgress(uint _escrowId) 
        external 
        view 
        validEscrow(_escrowId) 
        returns (
            EscrowState state,
            bool[3] memory milestones,
            bool[5] memory docs,
            uint[5] memory amounts
        ) 
    {
        EscrowTransaction storage escrow = escrows[_escrowId];
        
        state = escrow.state;
        milestones[0] = milestoneCompleted[_escrowId][Milestone.DueDiligence];
        milestones[1] = milestoneCompleted[_escrowId][Milestone.Deposit];
        milestones[2] = milestoneCompleted[_escrowId][Milestone.FinalSettlement];
        
        docs[0] = documents[_escrowId][DocumentType.SearchCertificate].verified;
        docs[1] = documents[_escrowId][DocumentType.DueDiligenceReport].verified;
        docs[2] = documents[_escrowId][DocumentType.SaleAgreement].verified;
        docs[3] = documents[_escrowId][DocumentType.OriginalTitle].verified;
        docs[4] = documents[_escrowId][DocumentType.LCBConsent].verified;
        
        amounts[0] = escrow.dueDiligenceFee;
        amounts[1] = escrow.depositAmount;
        amounts[2] = escrow.finalAmount;
        amounts[3] = escrow.facilitationFee;
        amounts[4] = escrow.depositedAmount;
    }
    
    function cancelEscrow(uint _escrowId) 
        external 
        onlyClient(_escrowId) 
        validEscrow(_escrowId)
        nonReentrant
    {
        EscrowTransaction storage escrow = escrows[_escrowId];
        require(escrow.state != EscrowState.Completed, "Cannot cancel completed escrow");
        
        escrow.state = EscrowState.Cancelled;
        
        if (escrow.depositedAmount > 0) {
            uint refundAmount = escrow.depositedAmount;
            escrow.depositedAmount = 0;
            _releaseFunds(_escrowId, escrow.client, refundAmount);
        }
        
        emit EscrowCancelled(_escrowId);
    }
    
    function getMultiSigAddress() external view returns (address) {
        return address(multiSigWallet);
    }
    
    function getBalance() external view returns (uint) {
        return address(multiSigWallet).balance;
    }
}
