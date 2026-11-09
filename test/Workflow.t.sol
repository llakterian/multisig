// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import "forge-std/Test.sol";
import "../contracts/EscrowFactory.sol";
import "../contracts/NotaryMediatedEscrow.sol";

contract WorkflowTest is Test {
    EscrowFactory factory;
    address treasury = address(0x11);
    address notary = address(0x22);
    address client = address(0x33);
    address seller = address(0x44);
    address msOwner = address(this);

    function setUp() public {
        address[] memory owners = new address[](1);
        owners[0] = msOwner;
        factory = new EscrowFactory(notary, owners, 1, treasury);
        vm.deal(client, 100 ether);
    }

    function testFactoryCreatesInitializedEscrow() public {
        NotaryMediatedEscrow e = NotaryMediatedEscrow(payable(factory.createEscrow(client, seller, notary, 1 ether)));
        (address c, address s, address n,,,,,,,,,,,,,,,,,,,,,) = e.escrows(0);
        assertEq(c, client); assertEq(s, seller); assertEq(n, notary);
    }

    function testFullFlowToCompletion() public {
        NotaryMediatedEscrow e = NotaryMediatedEscrow(payable(factory.createEscrow(client, seller, notary, 1 ether)));
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
        (NotaryMediatedEscrow.EscrowState st,,,) = e.getEscrowProgress(0);
        assertEq(uint(st), uint(NotaryMediatedEscrow.EscrowState.Completed));
    }
}
