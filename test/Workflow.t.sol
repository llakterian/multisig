// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import "forge-std/Test.sol";
import "../contracts/EscrowFactory.sol";
import "../contracts/NotaryMediatedEscrow.sol";
import "../contracts/MultiSigWallet.sol";

contract WorkflowTest is Test {
    EscrowFactory factory;
    address treasury = makeAddr("treasury");
    address notary = makeAddr("notary");
    address client = makeAddr("client");
    address seller = makeAddr("seller");
    address msOwner = address(this);

    function setUp() public {
        vm.deal(msOwner, 1 ether);
        vm.deal(treasury, 1 ether);
        vm.deal(client, 100 ether);
        vm.deal(seller, 1 ether);
        address[] memory owners = new address[](1);
        owners[0] = msOwner;
        factory = new EscrowFactory(notary, owners, 1, treasury);
    }

    function _escrow() internal returns (NotaryMediatedEscrow e) {
        e = NotaryMediatedEscrow(payable(factory.createEscrow(client, seller, notary, 1 ether)));
    }
    receive() external payable {}

    function testFactoryCreatesInitializedEscrow() public {
        NotaryMediatedEscrow e = _escrow();
        (address c, address s, address n,,,,,,,,,,,,,,,,) = e.escrows(0);
        assertEq(c, client); assertEq(s, seller); assertEq(n, notary);
    }

    function _advanceToCompleted(NotaryMediatedEscrow e) internal {
        vm.prank(treasury); e.uploadDigitalGallery(0);
        vm.prank(client); e.selectPlot(0);
        vm.prank(client); e.fundEscrow{value: 1 ether}(0, true);
        vm.startPrank(notary);
        e.uploadDocument(0, NotaryMediatedEscrow.DocumentType.DueDiligenceReport, keccak256("dd"));
        e.uploadDocument(0, NotaryMediatedEscrow.DocumentType.SearchCertificate, keccak256("sc"));
        vm.stopPrank();
        vm.startPrank(client);
        e.verifyDocument(0, NotaryMediatedEscrow.DocumentType.DueDiligenceReport);
        e.verifyDocument(0, NotaryMediatedEscrow.DocumentType.SearchCertificate);
        e.proceedWithPurchase(0);
        vm.stopPrank();
        vm.startPrank(notary);
        e.executeFiatBridge(0, 100000, 130);
        e.uploadLodgementReceipt(0, keccak256("lod"), block.timestamp + 30 days);
        e.completeTransfer(0, keccak256("title"), "TRACK123");
        vm.stopPrank();
    }

    function testFullFlowToCompletion() public {
        NotaryMediatedEscrow e = _escrow();
        _advanceToCompleted(e);
        (NotaryMediatedEscrow.EscrowState st,,) = e.getEscrowProgress(0);
        assertEq(uint(st), uint(NotaryMediatedEscrow.EscrowState.Completed));
    }

    function testFundReleaseStateGated() public {
        NotaryMediatedEscrow e = _escrow();
        _advanceToCompleted(e);
        MultiSigWallet ms = e.multiSigWallet();
        uint256 t0 = treasury.balance;
        bytes32 pdd = e.P_DD_FEE();
        ms.submitAuthorizedRelease(address(e), 0, payable(treasury), 0.05 ether, pdd);
        assertEq(treasury.balance, t0 + 0.05 ether);
        vm.expectRevert();
        ms.submitAuthorizedRelease(address(e), 0, payable(treasury), 0.05 ether, pdd);
        (,, uint256[6] memory amts) = e.getEscrowProgress(0);
        ms.submitAuthorizedRelease(address(e), 0, payable(treasury), amts[3], e.P_FACILITATION());
        assertEq(treasury.balance, t0 + 0.05 ether + amts[3]);
    }

    function testUnauthorizedReleaseRejected() public {
        NotaryMediatedEscrow e = _escrow();
        MultiSigWallet ms = e.multiSigWallet();
        bytes32 pdd = e.P_DD_FEE();
        vm.expectRevert("Release not authorized");
        ms.submitAuthorizedRelease(address(e), 0, payable(treasury), 0.05 ether, pdd);
    }

    function testCancelAllowsRefund() public {
        NotaryMediatedEscrow e = _escrow();
        vm.prank(treasury); e.uploadDigitalGallery(0);
        vm.prank(client); e.selectPlot(0);
        vm.prank(client); e.fundEscrow{value: 1 ether}(0, true);
        vm.prank(client); e.cancelEscrow(0);
        MultiSigWallet ms = e.multiSigWallet();
        uint256 before = client.balance;
        ms.submitAuthorizedRelease(address(e), 0, payable(client), 1 ether, e.P_REFUND());
        assertEq(client.balance, before + 1 ether);
    }
}
