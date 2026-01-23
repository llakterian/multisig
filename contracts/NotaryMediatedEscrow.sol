// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MultiSigWallet.sol";

contract NotaryMediatedEscrow is MultiSigWallet {
    
    // Escrow states
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
        TransferInProgress,
        Finalizing, 
        Completed, 
        Cancelled 
    }
    
    // Milestone types
    enum Milestone { 
        DueDiligence,    // $200 for registry search and site visit
        Deposit,         // Percentage-based deposit to seller
        FinalSettlement  // Balance + facilitation fee
    }
    
// Document types
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
    
    // Signing status
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
        address notary;          // Doddy - the oracle
        uint totalAmount;
        uint budget;             // Client budget
        uint desiredSize;        // Desired size in acres
        string purpose;           // Farming/Speculation
        uint dueDiligenceFee;    // $200
        uint depositAmount;      // Purchase funds
        uint finalAmount;        // Balance + facilitation fee
        uint facilitationFee;    // Sizland fee
        uint sellerKESAmount;    // Fiat amount paid to seller in KES
        uint exchangeRate;        // Crypto to KES exchange rate
        EscrowState state;
        uint createdAt;
        uint fundedAt;
        uint completedAt;
        uint expectedCompletionDate; // Registry wait estimate
        string courierTracking;   // Shipping tracking number
        bool documentsSecured;    // Original documents in vault
        uint facilitationFeeBasisPoints; // Customizable fee
        uint depositBasisPoints;         // Customizable deposit %
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
    
    // Mappings
    mapping(uint => EscrowTransaction) public escrows;
    mapping(uint => mapping(Milestone => bool)) public milestoneCompleted;
    mapping(uint => mapping(DocumentType => Document)) public documents;
    mapping(uint => mapping(address => bool)) public partyNotifications;
    mapping(uint => mapping(address => bool)) public clientConfirmed;
    mapping(uint => mapping(address => bool)) public notaryConfirmed;
    
    // Events
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
    
    // Constants
    // Constants (Defaults)
    uint public constant DEFAULT_DUE_DILIGENCE_FEE = 0.05 ether; // ~$200 at generic rates
    uint public constant DEFAULT_FACILITATION_FEE_PERCENT = 200; // 2%
    uint public constant DEFAULT_DEPOSIT_PERCENT = 1000; // 10%
    
    uint public escrowCount;
    address public sizlandTreasury;
    
    modifier onlyClient(uint _escrowId) {
        require(msg.sender == escrows[_escrowId].client, "Only client can call this");
        _;
    }
    
    modifier onlyNotary(uint _escrowId) {
        require(msg.sender == escrows[_escrowId].notary, "Only notary can call this");
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
    ) MultiSigWallet(_owners, _numConfirmationsRequired) {
        require(_sizlandTreasury != address(0), "Invalid treasury address");
        sizlandTreasury = _sizlandTreasury;
    }
    
    /**
     * @dev Creates intake for land purchase
     * @param _budget Client's budget (e.g., $5,000)
     * @param _desiredSize Desired size in acres
     * @param _purpose Purpose (Farming/Speculation)
     * @param _seller The property seller
     * @param _notary The notary (Doddy)
     */
    function createIntake(
        uint _budget,
        uint _desiredSize,
        string memory _purpose,
        address _seller,
        address _notary
    ) public returns (uint escrowId) {
        require(_seller != address(0), "Invalid seller address");
        require(_notary != address(0), "Invalid notary address");
        require(_budget >= DEFAULT_DUE_DILIGENCE_FEE, "Budget too low");
        require(_desiredSize > 0, "Invalid size");
        
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
            depositAmount: 0, // Will be calculated after selection/negotiation
            finalAmount: 0,   // Will be calculated after selection/negotiation
            facilitationFee: 0, // Will be calculated after selection/negotiation
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
            depositBasisPoints: DEFAULT_DEPOSIT_PERCENT
        });
        
        emit EscrowCreated(escrowId, msg.sender, _seller, _notary, _budget, _desiredSize, _purpose);
        emit IntakeCompleted(escrowId, _budget, _desiredSize, _purpose);
    }
    
    /**
     * @dev Upload digital gallery (Sizland admin only)
     */
    function uploadDigitalGallery(
        uint _escrowId,
        string[] memory _geoPins,
        string[] memory _photos,
        string[] memory _videos
    ) public validEscrow(_escrowId) {
        require(msg.sender == sizlandTreasury, "Only Sizland admin can upload gallery");
        require(escrows[_escrowId].state == EscrowState.Intake, "Wrong state");
        
        escrows[_escrowId].state = EscrowState.Discovery;
        
        emit DigitalGalleryUploaded(_escrowId, _geoPins, _photos, _videos);
    }
    
    /**
     * @dev Client selects plot from gallery
     */
    function selectPlot(uint _escrowId) public onlyClient(_escrowId) validEscrow(_escrowId) {
        require(escrows[_escrowId].state == EscrowState.Discovery, "Not in discovery phase");
        escrows[_escrowId].state = EscrowState.PlotSelected;
    }
    
    /**
     * @dev Funds the escrow with total amount or initial $200
     */
    function fundEscrow(uint _escrowId, bool _fullAmount) 
        public 
        payable 
        validEscrow(_escrowId)
        escrowState(_escrowId, EscrowState.PlotSelected)
    {
        uint requiredAmount = _fullAmount ? escrows[_escrowId].budget : DEFAULT_DUE_DILIGENCE_FEE;
        require(msg.value >= requiredAmount, "Incorrect amount");
        
        if (!_fullAmount) {
            // Immediate release of $200 to notary
            _releaseFunds(_escrowId, escrows[_escrowId].notary, DEFAULT_DUE_DILIGENCE_FEE);
        }
        
        if (_fullAmount) {
            escrows[_escrowId].state = EscrowState.DueDiligencePending;
        } else {
            escrows[_escrowId].state = EscrowState.DueDiligencePending;
        }
        
        escrows[_escrowId].fundedAt = block.timestamp;
        
        emit EscrowFunded(_escrowId, msg.value, DEFAULT_DUE_DILIGENCE_FEE);
    }
    
    /**
     * @dev Notary uploads due diligence report
     */
    function uploadDueDiligenceReport(uint _escrowId, bytes32 _reportHash) 
        public 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
    {
        require(escrows[_escrowId].state == EscrowState.DueDiligencePending, "Wrong state");
        
        Document storage doc = documents[_escrowId][DocumentType.DueDiligenceReport];
        doc.documentHash = _reportHash;
        doc.uploadedAt = block.timestamp;
        doc.verified = false;
        doc.uploadedBy = msg.sender;
        doc.signingStatus = SigningStatus.NotStarted;
        doc.clientSignedAt = 0;
        doc.sellerSignedAt = 0;
        doc.notaryVerifiedAt = 0;
        
        emit DueDiligenceReportUploaded(_escrowId, _reportHash);
        emit DocumentUploaded(_escrowId, DocumentType.DueDiligenceReport, _reportHash, msg.sender);
    }
    
    /**
     * @dev Upload draft sale agreement (client or seller)
     */
    function uploadDraftAgreement(
        uint _escrowId,
        bytes32 _hash
    ) public validEscrow(_escrowId) {
        require(msg.sender == escrows[_escrowId].client || msg.sender == escrows[_escrowId].seller, "Only client or seller can upload draft");
        
        Document storage doc = documents[_escrowId][DocumentType.DraftSaleAgreement];
        doc.documentHash = _hash;
        doc.uploadedAt = block.timestamp;
        doc.uploadedBy = msg.sender;
        doc.signingStatus = SigningStatus.Draft;
        
        emit DraftAgreementUploaded(_escrowId, _hash, msg.sender);
        emit DocumentUploaded(_escrowId, DocumentType.DraftSaleAgreement, _hash, msg.sender);
        
        // Notify the other party
        address otherParty = msg.sender == escrows[_escrowId].client ? escrows[_escrowId].seller : escrows[_escrowId].client;
        _notifyParty(_escrowId, otherParty, "Draft sale agreement uploaded for review");
    }
    
    /**
     * @dev Sign document on platform
     */
    function signDocument(
        uint _escrowId,
        DocumentType _docType
    ) public validEscrow(_escrowId) {
        require(_docType == DocumentType.DraftSaleAgreement, "Can only sign draft agreement");
        require(msg.sender == escrows[_escrowId].client || msg.sender == escrows[_escrowId].seller, "Only parties can sign");
        require(!documents[_escrowId][_docType].hasSigned[msg.sender], "Already signed");
        
        Document storage doc = documents[_escrowId][_docType];
        doc.hasSigned[msg.sender] = true;
        
        string memory signerRole = msg.sender == escrows[_escrowId].client ? "Client" : "Seller";
        
        if (msg.sender == escrows[_escrowId].client) {
            doc.clientSignedAt = block.timestamp;
            doc.signingStatus = SigningStatus.ClientSigned;
        } else {
            doc.sellerSignedAt = block.timestamp;
            doc.signingStatus = SigningStatus.SellerSigned;
        }
        
        emit DocumentSigned(_escrowId, _docType, msg.sender, signerRole);
        
        // Notify the other party
        address otherParty = msg.sender == escrows[_escrowId].client ? escrows[_escrowId].seller : escrows[_escrowId].client;
        _notifyParty(_escrowId, otherParty, string(abi.encodePacked(signerRole, " has signed the agreement")));
        
        // Check if both parties have signed
        if (doc.hasSigned[escrows[_escrowId].client] && doc.hasSigned[escrows[_escrowId].seller]) {
            doc.signingStatus = SigningStatus.BothSigned;
            emit BothPartiesSigned(_escrowId, _docType);
            
            // Notify notary
            _notifyParty(_escrowId, escrows[_escrowId].notary, "Both parties have signed the agreement - ready for notarization");
        }
    }
    
    /**
     * @dev Notary verifies signed document and proceeds to next step
     */
    function notarizeSignedDocument(
        uint _escrowId,
        DocumentType _docType
    ) public onlyNotary(_escrowId) validEscrow(_escrowId) {
        require(_docType == DocumentType.DraftSaleAgreement, "Can only notarize signed agreement");
        require(documents[_escrowId][_docType].signingStatus == SigningStatus.BothSigned, "Both parties must sign first");
        
        Document storage doc = documents[_escrowId][_docType];
        doc.signingStatus = SigningStatus.NotaryVerified;
        doc.notaryVerifiedAt = block.timestamp;
        doc.verified = true;
        
        // Create signed document record
        Document storage signedDoc = documents[_escrowId][DocumentType.SignedSaleAgreement];
        signedDoc.documentHash = doc.documentHash;
        signedDoc.uploadedAt = doc.uploadedAt;
        signedDoc.verified = true;
        signedDoc.uploadedBy = doc.uploadedBy;
        signedDoc.signingStatus = SigningStatus.NotaryVerified;
        signedDoc.clientSignedAt = doc.clientSignedAt;
        signedDoc.sellerSignedAt = doc.sellerSignedAt;
        signedDoc.notaryVerifiedAt = doc.notaryVerifiedAt;
        // Note: mapping hasSigned is initialized to false by default
        
        emit NotaryVerifiedSignedDocument(_escrowId, _docType);
        emit DocumentVerified(_escrowId, DocumentType.SignedSaleAgreement);
        
        // Notify parties that notarization is complete
        _notifyParty(_escrowId, escrows[_escrowId].client, "Agreement has been notarized - ready for deposit release");
        _notifyParty(_escrowId, escrows[_escrowId].seller, "Agreement has been notarized - ready for deposit release");
    }
    
    /**
     * @dev Notary uploads other documents (registry search, site visit, etc.)
     */
    function uploadDocument(
        uint _escrowId,
        DocumentType _docType,
        bytes32 _hash
    ) public onlyNotary(_escrowId) validEscrow(_escrowId) {
        require(_docType != DocumentType.DraftSaleAgreement, "Use uploadDraftAgreement for sale agreement");
        
        Document storage doc = documents[_escrowId][_docType];
        doc.documentHash = _hash;
        doc.uploadedAt = block.timestamp;
        doc.uploadedBy = msg.sender;
        doc.verified = false;
        
        emit DocumentUploaded(_escrowId, _docType, _hash, msg.sender);
    }
    
    /**
     * @dev Internal notification function
     */
    function _notifyParty(uint _escrowId, address _party, string memory _message) internal {
        partyNotifications[_escrowId][_party] = true;
        emit PartyNotified(_escrowId, _party, _message);
    }
    
    /**
     * @dev Client verifies document
     */
    function verifyDocument(
        uint _escrowId,
        DocumentType _docType
    ) public onlyClient(_escrowId) validEscrow(_escrowId) {
        require(documents[_escrowId][_docType].uploadedAt > 0, "Document not uploaded");
        
        documents[_escrowId][_docType].verified = true;
        emit DocumentVerified(_escrowId, _docType);
        
        // Check if due diligence is complete
        if (_docType == DocumentType.SearchCertificate && 
            documents[_escrowId][DocumentType.DueDiligenceReport].verified) {
            _completeDueDiligence(_escrowId);
        }
    }
    
    /**
     * @dev Notary sets negotiated rates after successful DD
     */
    function setNegotiatedRates(
        uint _escrowId, 
        uint _depositBP, 
        uint _facilitationBP
    ) 
        public 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId)
    {
        require(escrows[_escrowId].state >= EscrowState.DueDiligenceComplete, "DD not complete");
        require(_depositBP <= 10000 && _facilitationBP <= 5000, "Invalid rates");

        EscrowTransaction storage escrow = escrows[_escrowId];
        escrow.depositBasisPoints = _depositBP;
        escrow.facilitationFeeBasisPoints = _facilitationBP;

        // Recalculate amounts based on total budget
        uint availableForPurchase = escrow.budget - escrow.dueDiligenceFee;
        escrow.facilitationFee = (escrow.budget * _facilitationBP) / 10000;
        escrow.depositAmount = (availableForPurchase * _depositBP) / 10000;
        escrow.finalAmount = availableForPurchase - escrow.depositAmount - escrow.facilitationFee;

        emit PartyNotified(_escrowId, escrow.client, "Negotiated rates have been set by the notary");
    }

    /**
     * @dev Complete due diligence milestone and release $200 (default) to notary
     */
    function _completeDueDiligence(uint _escrowId) internal {
        require(uint(escrows[_escrowId].state) == uint(EscrowState.DueDiligencePending), "Wrong state");
        
        milestoneCompleted[_escrowId][Milestone.DueDiligence] = true;
        escrows[_escrowId].state = EscrowState.DueDiligenceComplete;
        
        // Release due diligence fee to notary
        _releaseFunds(_escrowId, escrows[_escrowId].notary, escrows[_escrowId].dueDiligenceFee);
        
        emit MilestoneCompleted(_escrowId, Milestone.DueDiligence);
    }
    
    /**
     * @dev Client decides to proceed with purchase after DD report
     */
    function proceedWithPurchase(uint _escrowId) 
        public 
        onlyClient(_escrowId) 
        validEscrow(_escrowId)
        escrowState(_escrowId, EscrowState.DueDiligenceComplete)
    {
        escrows[_escrowId].state = EscrowState.ExecutionPending;
    }
    
    /**
     * @dev Notary executes fiat bridge - converts crypto to KES and pays seller
     */
    function executeFiatBridge(
        uint _escrowId,
        uint _kesAmount,
        uint _exchangeRate
    ) 
        public 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
        escrowState(_escrowId, EscrowState.ExecutionPending)
    {
        require(_kesAmount > 0, "Invalid KES amount");
        require(_exchangeRate > 0, "Invalid exchange rate");
        
        escrows[_escrowId].sellerKESAmount = _kesAmount;
        escrows[_escrowId].exchangeRate = _exchangeRate;
        escrows[_escrowId].state = EscrowState.ExecutionComplete;
        
        // Mark documents as secured
        escrows[_escrowId].documentsSecured = true;
        
        emit FiatBridgeExecuted(_escrowId, escrows[_escrowId].depositAmount, _kesAmount, _exchangeRate);
        emit FundsDisbursedToSeller(_escrowId, _kesAmount);
        emit DocumentsSecured(_escrowId, "Original Title, Signed Transfers, LCB Consents");
    }
    
    /**
     * @dev Notary uploads lodgement receipt and sets expected completion date
     */
    function uploadLodgementReceipt(
        uint _escrowId,
        bytes32 _receiptHash,
        uint _expectedCompletionDate
    ) 
        public 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
        escrowState(_escrowId, EscrowState.ExecutionComplete)
    {
        escrows[_escrowId].state = EscrowState.TransferRegistry;
        escrows[_escrowId].expectedCompletionDate = _expectedCompletionDate;
        
        Document storage receiptDoc = documents[_escrowId][DocumentType.LodgementReceipt];
        receiptDoc.documentHash = _receiptHash;
        receiptDoc.uploadedAt = block.timestamp;
        receiptDoc.verified = true;
        receiptDoc.uploadedBy = msg.sender;
        receiptDoc.signingStatus = SigningStatus.NotStarted;
        receiptDoc.clientSignedAt = 0;
        receiptDoc.sellerSignedAt = 0;
        receiptDoc.notaryVerifiedAt = 0;
        
        emit LodgementReceiptUploaded(_escrowId, _receiptHash, _expectedCompletionDate);
        emit DocumentUploaded(_escrowId, DocumentType.LodgementReceipt, _receiptHash, msg.sender);
    }
    
    /**
     * @dev Notary uploads final title and sets courier tracking
     */
    function completeTransfer(
        uint _escrowId,
        bytes32 _titleHash,
        string memory _courierTracking
    ) 
        public 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId) 
        escrowState(_escrowId, EscrowState.TransferRegistry)
    {
        escrows[_escrowId].state = EscrowState.Finalizing;
        escrows[_escrowId].courierTracking = _courierTracking;
        
        Document storage titleDoc = documents[_escrowId][DocumentType.OriginalTitle];
        titleDoc.documentHash = _titleHash;
        titleDoc.uploadedAt = block.timestamp;
        titleDoc.verified = true;
        titleDoc.uploadedBy = msg.sender;
        titleDoc.signingStatus = SigningStatus.NotStarted;
        titleDoc.clientSignedAt = 0;
        titleDoc.sellerSignedAt = 0;
        titleDoc.notaryVerifiedAt = 0;
        
        // Release facilitation fee to Sizland
        _releaseFunds(_escrowId, sizlandTreasury, escrows[_escrowId].facilitationFee);
        
        escrows[_escrowId].state = EscrowState.Completed;
        escrows[_escrowId].completedAt = block.timestamp;
        
        emit TitleIssued(_escrowId, _titleHash, _courierTracking);
        emit DocumentUploaded(_escrowId, DocumentType.OriginalTitle, _titleHash, msg.sender);
        emit EscrowCompleted(_escrowId);
    }
    
    /**
     * @dev Final settlement - notary confirms original title and LCB consents
     */
    function finalizeTransfer(uint _escrowId) 
        public 
        onlyNotary(_escrowId) 
        validEscrow(_escrowId)
        escrowState(_escrowId, EscrowState.ExecutionPending)
    {
        require(documents[_escrowId][DocumentType.OriginalTitle].verified, "Original title not verified");
        require(documents[_escrowId][DocumentType.LCBConsent].verified, "LCB consent not verified");
        
        milestoneCompleted[_escrowId][Milestone.FinalSettlement] = true;
        escrows[_escrowId].state = EscrowState.TransferInProgress;
        
        // Release final amount to seller
        _releaseFunds(_escrowId, escrows[_escrowId].seller, escrows[_escrowId].finalAmount);
        
        // Release facilitation fee to Sizland
        _releaseFunds(_escrowId, sizlandTreasury, escrows[_escrowId].facilitationFee);
        
        escrows[_escrowId].state = EscrowState.Completed;
        escrows[_escrowId].completedAt = block.timestamp;
        
        emit MilestoneCompleted(_escrowId, Milestone.FinalSettlement);
        emit EscrowCompleted(_escrowId);
    }
    
    /**
     * @dev Internal function to release funds using multi-sig
     */
    function _releaseFunds(uint _escrowId, address _recipient, uint _amount) internal {
        // Submit transaction to multi-sig
        submitTransaction(_recipient, _amount, "");
    }
    
    /**
     * @dev Get escrow progress for UI
     */
    function getEscrowProgress(uint _escrowId) 
        public 
        view 
        validEscrow(_escrowId) 
        returns (
            EscrowState state,
            bool[3] memory milestones, // DueDiligence, Deposit, FinalSettlement
            bool[5] memory docs,      // All document types
            uint[4] memory amounts     // dueDiligenceFee, depositAmount, finalAmount, facilitationFee
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
    }
    
    /**
     * @dev Cancel escrow (emergency function)
     */
    function cancelEscrow(uint _escrowId) 
        public 
        onlyClient(_escrowId) 
        validEscrow(_escrowId)
    {
        require(escrows[_escrowId].state != EscrowState.Completed, "Cannot cancel completed escrow");
        
        escrows[_escrowId].state = EscrowState.Cancelled;
        
        // Refund client if escrow was funded
        if (escrows[_escrowId].fundedAt > 0) {
            _releaseFunds(_escrowId, escrows[_escrowId].client, escrows[_escrowId].totalAmount);
        }
        
        emit EscrowCancelled(_escrowId);
    }
}