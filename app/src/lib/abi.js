export const PHASES = ['Created','Intake','Discovery','Plot selected','Funded','Due diligence pending','Due diligence complete','Execution pending','Execution complete','Transfer registry','Completed','Cancelled']
export const DOC_TYPES = ['SearchCertificate','DueDiligenceReport','DraftSaleAgreement','SignedSaleAgreement','SaleAgreement','LodgementReceipt','OriginalTitle','LCBConsent']
export const PURPOSES = {
  P_DD_FEE: '0x4507ae1344edacb88e5304012bd7a4dc662975bde2c5f99872f3637b29cfb77f', // keccak256("DD_FEE")? compute at runtime fallback
}
export const FACTORY_ABI = [
  "function createEscrow(address client,address seller,address notary,uint256 totalAmount) returns (address)",
  "function createEscrowWithDefaultNotary(address client,address seller,uint256 totalAmount) returns (address)",
  "function getUserEscrows(address) view returns (address[])",
  "function getEscrowCount() view returns (uint256)",
  "function defaultNotary() view returns (address)",
  "event EscrowCreated(address indexed escrowContract,address indexed client,address indexed seller,address notary,uint256 totalAmount)"
]
export const ESCROW_ABI = [
  "function escrows(uint256) view returns (address client,address seller,address notary,uint256 totalAmount,uint256 budget,uint256 desiredSize,string purpose,uint256 dueDiligenceFee,uint256 depositAmount,uint256 finalAmount,uint256 facilitationFee,uint8 state,uint256 createdAt,uint256 fundedAt,uint256 completedAt,uint256 facilitationFeeBasisPoints,uint256 depositBasisPoints,uint256 depositedAmount,uint256 releasedAmount)",
  "function getEscrowProgress(uint256) view returns (uint8 state,bool[4] releases,uint256[6] amounts)",
  "function getMultiSigAddress() view returns (address)",
  "function getBalance() view returns (uint256)",
  "function treasury() view returns (address)",
  "function createIntake(uint256 budget,uint256 desiredSize,string purpose,address seller,address notary) returns (uint256)",
  "function uploadDigitalGallery(uint256 id)",
  "function selectPlot(uint256 id)",
  "function fundEscrow(uint256 id,bool fullAmount) payable",
  "function uploadDocument(uint256 id,uint8 dt,bytes32 hash)",
  "function verifyDocument(uint256 id,uint8 dt)",
  "function setNegotiatedRates(uint256 id,uint256 depositBP,uint256 facilitationBP)",
  "function proceedWithPurchase(uint256 id)",
  "function executeFiatBridge(uint256 id,uint256 kesAmount,uint256 exchangeRate)",
  "function uploadLodgementReceipt(uint256 id,bytes32 hash,uint256 expected)",
  "function completeTransfer(uint256 id,bytes32 titleHash,string tracking)",
  "function cancelEscrow(uint256 id)",
  "function releaseAuthorized(uint256 id,address to,uint256 amount,bytes32 purpose) view returns (bool)",
  "function P_DD_FEE() view returns (bytes32)",
  "function P_FACILITATION() view returns (bytes32)",
  "function P_REFUND() view returns (bytes32)",
  "function P_SELLER_PROCEEDS() view returns (bytes32)"
]
export const MS_ABI = [
  "function getOwners() view returns (address[])",
  "function getTransactionCount() view returns (uint256)",
  "function getTransaction(uint256) view returns (address to,uint256 value,bytes data,bool executed,uint256 numConfirmations)",
  "function submitAuthorizedRelease(address escrow,uint256 escrowId,address to,uint256 value,bytes32 purpose) returns (uint256)",
  "function confirmTransaction(uint256 txIndex)",
  "function isOwner(address) view returns (bool)"
]
