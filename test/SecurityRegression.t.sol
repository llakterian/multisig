// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import "forge-std/Test.sol";
import "../contracts/EscrowFactory.sol";
import "../contracts/NotaryMediatedEscrow.sol";
import "../contracts/MultiSigWallet.sol";

contract SecurityRegressionTest is Test {
    EscrowFactory factory;
    address treasury = address(0x71); address notary = address(0x72); address client = address(0x73); address seller = address(0x74); address attacker = address(0x75);
    function setUp() public {
        vm.deal(client, 100 ether); vm.deal(attacker, 10 ether); vm.deal(treasury, 1 ether); vm.deal(seller, 1 ether);
        address[] memory owners = new address[](1); owners[0] = address(this);
        factory = new EscrowFactory(notary, owners, 1, treasury);
    }
    receive() external payable {}
    function _completed() internal returns (NotaryMediatedEscrow e) {
        e = NotaryMediatedEscrow(payable(factory.createEscrow(client, seller, notary, 1 ether)));
        vm.prank(treasury); e.uploadDigitalGallery(0); vm.prank(client); e.selectPlot(0);
        vm.prank(client); e.fundEscrow{value: 1 ether}(0, true);
        vm.startPrank(notary);
        e.uploadDocument(0, NotaryMediatedEscrow.DocumentType.DueDiligenceReport, keccak256("dd"));
        e.uploadDocument(0, NotaryMediatedEscrow.DocumentType.SearchCertificate, keccak256("sc")); vm.stopPrank();
        vm.startPrank(client);
        e.verifyDocument(0, NotaryMediatedEscrow.DocumentType.DueDiligenceReport);
        e.verifyDocument(0, NotaryMediatedEscrow.DocumentType.SearchCertificate);
        e.proceedWithPurchase(0); vm.stopPrank();
        vm.startPrank(notary);
        e.executeFiatBridge(0, 1, 1); e.uploadLodgementReceipt(0, keccak256("l"), 1); e.completeTransfer(0, keccak256("t"), "x"); vm.stopPrank();
    }
    function testAttackerCannotInitializeEscrow() public { NotaryMediatedEscrow e = NotaryMediatedEscrow(payable(factory.createEscrow(client,seller,notary,1 ether))); vm.prank(attacker); vm.expectRevert("Only factory"); e.initializeEscrow(attacker,attacker,attacker,1 ether); }
    function testCannotConsumeReleaseWithoutMultisig() public { NotaryMediatedEscrow e = _completed(); bytes32 p=e.P_DD_FEE(); vm.prank(attacker); vm.expectRevert("Only multisig"); e.consumeRelease(0, treasury, 0.05 ether, p); }
    function testSellerCannotDrainExcess() public { NotaryMediatedEscrow e = _completed(); assertFalse(e.releaseAuthorized(0,seller,1 ether,e.P_SELLER_PROCEEDS())); uint256 toSeller = 1 ether - e.DEFAULT_DUE_DILIGENCE_FEE() - (1 ether * e.DEFAULT_FACILITATION_FEE_BP()/e.BASIS_POINTS_MAX()); assertTrue(e.releaseAuthorized(0,seller,toSeller,e.P_SELLER_PROCEEDS())); e.multiSigWallet().submitAuthorizedRelease(address(e),0,payable(seller),toSeller,e.P_SELLER_PROCEEDS()); }
    function testRefundMustBeExactRemaining() public { NotaryMediatedEscrow e = NotaryMediatedEscrow(payable(factory.createEscrow(client,seller,notary,1 ether))); vm.prank(treasury); e.uploadDigitalGallery(0); vm.prank(client); e.selectPlot(0); vm.prank(client); e.fundEscrow{value:1 ether}(0,true); vm.prank(client); e.cancelEscrow(0); assertFalse(e.releaseAuthorized(0,client,0.5 ether,e.P_REFUND())); assertTrue(e.releaseAuthorized(0,client,1 ether,e.P_REFUND())); }
    function testRatesOnlyInDDComplete() public { NotaryMediatedEscrow e = NotaryMediatedEscrow(payable(factory.createEscrow(client,seller,notary,1 ether))); vm.prank(notary); vm.expectRevert("Wrong state"); e.setNegotiatedRates(0,1000,200); }
    function testRatesCannotExceedAvailable() public { NotaryMediatedEscrow e = NotaryMediatedEscrow(payable(factory.createEscrow(client,seller,notary,1 ether))); vm.prank(treasury); e.uploadDigitalGallery(0); vm.prank(client); e.selectPlot(0); vm.prank(client); e.fundEscrow{value:1 ether}(0,true); vm.startPrank(notary); e.uploadDocument(0,NotaryMediatedEscrow.DocumentType.DueDiligenceReport,keccak256("dd")); e.uploadDocument(0,NotaryMediatedEscrow.DocumentType.SearchCertificate,keccak256("sc")); vm.stopPrank(); vm.startPrank(client); e.verifyDocument(0,NotaryMediatedEscrow.DocumentType.DueDiligenceReport); e.verifyDocument(0,NotaryMediatedEscrow.DocumentType.SearchCertificate); vm.stopPrank(); vm.prank(notary); vm.expectRevert("Rates exceed available"); e.setNegotiatedRates(0,10000,500); }
    function testReleaseSlotSingleUse() public { NotaryMediatedEscrow e = _completed(); MultiSigWallet ms=e.multiSigWallet(); bytes32 p=e.P_DD_FEE(); ms.submitAuthorizedRelease(address(e),0,payable(treasury),0.05 ether,p); vm.expectRevert("Release not authorized"); ms.submitAuthorizedRelease(address(e),0,payable(treasury),0.05 ether,p); }
    function testDirectEthToEscrowReverts() public { NotaryMediatedEscrow e = _completed(); (bool ok,)=address(e).call{value:0.1 ether}(""); assertFalse(ok); }
    function testTimelockPayloadBinding() public { bytes32 id=factory.scheduleNotaryUpdate(attacker); vm.warp(block.timestamp+3 days); vm.expectRevert("Payload mismatch"); factory.executeNotaryUpdate(id,notary); factory.executeNotaryUpdate(id,attacker); assertEq(factory.defaultNotary(),attacker); }
}
