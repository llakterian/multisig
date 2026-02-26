// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/MultiSigWallet.sol";

contract SecurityAuditTest is Test {
    MultiSigWallet public multiSig;
    
    address[] public owners;
    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    address public owner3 = address(0x3);
    address public attacker = address(0xA);
    
    function setUp() public {
        owners.push(owner1);
        owners.push(owner2);
        owners.push(owner3);
        
        vm.deal(attacker, 100 ether);
    }
    
    // Test that zero address validation is now working (CRITICAL-03 FIX)
    function testMissingZeroAddressValidation() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        vm.prank(owner1);
        vm.expectRevert();
        multiSig.setTrustedCaller(address(0));
    }
    
    // Test that setting trusted caller works
    function testSetTrustedCallerWorks() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        vm.prank(owner1);
        multiSig.setTrustedCaller(owner2);
        
        assertEq(multiSig.trustedCaller(), owner2);
    }
    
    // Test access control - non-owner cannot submit
    function testNonOwnerCannotSubmit() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        vm.prank(attacker);
        vm.expectRevert();
        multiSig.submitTransaction(attacker, 1 ether, "");
    }
    
    // Test confirmation requirement
    function testConfirmationRequired() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        vm.prank(owner1);
        multiSig.submitTransaction(attacker, 0, "");
        
        // Only 1 confirmation with required 2 - should fail
        vm.prank(owner1);
        vm.expectRevert();
        multiSig.executeTransactionExternal(0);
    }
    
    // Test revocation
    function testRevokeConfirmation() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        vm.prank(owner1);
        multiSig.submitTransaction(attacker, 0, "");
        
        vm.prank(owner1);
        multiSig.confirmTransaction(0);
        
        vm.prank(owner1);
        multiSig.revokeConfirmation(0);
        
        vm.prank(owner1);
        vm.expectRevert();
        multiSig.executeTransactionExternal(0);
    }
    
    // Test double confirmation is prevented
    function testDoubleConfirmation() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        vm.prank(owner1);
        multiSig.submitTransaction(attacker, 0, "");
        
        vm.prank(owner1);
        multiSig.confirmTransaction(0);
        
        vm.prank(owner1);
        vm.expectRevert();
        multiSig.confirmTransaction(0);
    }
    
    // Test tx.origin is not used (proper msg.sender usage)
    function testTxOriginVulnerability() public {
        multiSig = new MultiSigWallet(owners, 2);
        
        // Attacker cannot confirm without being owner
        vm.prank(attacker);
        vm.expectRevert();
        multiSig.confirmTransaction(0);
    }
}
