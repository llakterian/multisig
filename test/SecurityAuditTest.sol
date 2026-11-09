// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "forge-std/Test.sol";
import "../contracts/MultiSigWallet.sol";
import "../contracts/EscrowFactory.sol";
import "../contracts/NotaryMediatedEscrow.sol";

contract SecurityAuditTest is Test {
    MultiSigWallet wallet;
    address owner1 = address(0xA1);
    address owner2 = address(0xA2);
    address owner3 = address(0xA3);
    address attacker = address(0xBAD);

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1; owners[1] = owner2; owners[2] = owner3;
        wallet = new MultiSigWallet(owners, 2);
        vm.deal(address(wallet), 10 ether);
    }

    function testNonOwnerCannotSubmit() public {
        vm.prank(attacker);
        vm.expectRevert("not owner");
        wallet.submitTransaction(attacker, 1 ether, "");
    }

    function testSubmitRejectsZeroDestination() public {
        vm.prank(owner1);
        vm.expectRevert("Invalid destination address");
        wallet.submitTransaction(address(0), 0, "");
    }

    function testConfirmationAndExecution() public {
        vm.prank(owner1);
        wallet.submitTransaction(attacker, 1 ether, "");
        vm.prank(owner1);
        wallet.confirmTransaction(0);
        uint256 before = attacker.balance;
        vm.prank(owner2);
        wallet.confirmTransaction(0);
        assertEq(attacker.balance - before, 1 ether);
    }

    function testDoubleConfirmReverts() public {
        vm.prank(owner1);
        wallet.submitTransaction(attacker, 0, "");
        vm.prank(owner1);
        wallet.confirmTransaction(0);
        vm.prank(owner1);
        vm.expectRevert("tx already confirmed");
        wallet.confirmTransaction(0);
    }

    function testRevoke() public {
        vm.prank(owner1);
        wallet.submitTransaction(attacker, 0, "");
        vm.prank(owner1);
        wallet.confirmTransaction(0);
        vm.prank(owner1);
        wallet.revokeConfirmation(0);
        (, , , , uint256 n) = wallet.getTransaction(0);
        assertEq(n, 0);
    }

    function testTimelockNotExecutableEarly() public {
        address[] memory owners = new address[](1);
        owners[0] = owner1;
        EscrowFactory f = new EscrowFactory(owner2, owners, 1, owner3); // owner=this
        bytes32 id = f.scheduleNotaryUpdate(attacker);
        vm.expectRevert("Action not ready");
        f.executeNotaryUpdate(id, attacker);
    }

    function testTimelockExecutesAfterDelay() public {
        address[] memory owners = new address[](1);
        owners[0] = owner1;
        EscrowFactory f = new EscrowFactory(owner2, owners, 1, owner3);
        bytes32 id = f.scheduleNotaryUpdate(attacker);
        vm.warp(block.timestamp + f.actionDelay() + 1);
        f.executeNotaryUpdate(id, attacker);
        assertEq(f.defaultNotary(), attacker);
    }
}
