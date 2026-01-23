// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NotaryMediatedEscrow.sol";

contract EscrowFactory {
    
    address public doddyNotary; // Default notary (Doddy)
    address[] public escrowContracts;
    mapping(address => bool) public isEscrowContract;
    mapping(address => address[]) public userEscrows;
    
    // Owner management
    address public owner;
    mapping(address => bool) public isOwner;
    
    // Default multi-sig owners for new escrows
    address[] public defaultOwners;
    uint public defaultNumConfirmationsRequired;
    address public sizlandTreasury;
    
    // Events
    event EscrowCreated(
        address indexed escrowContract,
        address indexed client,
        address indexed seller,
        address notary,
        uint totalAmount
    );
    
    event DoddyNotaryUpdated(address oldNotary, address newNotary);
    event DefaultOwnersUpdated(address[] newOwners);
    event DefaultConfirmationsUpdated(uint newConfirmations);
    
    constructor(
        address _doddyNotary,
        address[] memory _defaultOwners,
        uint _defaultNumConfirmationsRequired,
        address _sizlandTreasury
    ) {
        require(_doddyNotary != address(0), "Invalid notary address");
        require(_sizlandTreasury != address(0), "Invalid treasury address");
        require(_defaultOwners.length > 0, "Default owners required");
        require(_defaultNumConfirmationsRequired > 0 && _defaultNumConfirmationsRequired <= _defaultOwners.length, "Invalid confirmations");
        
        owner = msg.sender;
        isOwner[msg.sender] = true;
        
        doddyNotary = _doddyNotary;
        defaultOwners = _defaultOwners;
        defaultNumConfirmationsRequired = _defaultNumConfirmationsRequired;
        sizlandTreasury = _sizlandTreasury;
    }
    
    /**
     * @dev Creates a new escrow contract with Doddy as default notary
     * @param _seller The property seller
     * @param _totalAmount Total purchase amount
     * @return escrowContract The address of the new escrow contract
     */
    function createEscrowWithDoddy(
        address _seller,
        uint _totalAmount
    ) public returns (address escrowContract) {
        return createEscrow(_seller, doddyNotary, _totalAmount);
    }
    
    /**
     * @dev Creates a new escrow contract with custom notary
     * @param _seller The property seller
     * @param _notary The notary (can be Doddy or custom)
     * @param _totalAmount Total purchase amount
     * @return escrowContract The address of the new escrow contract
     */
    function createEscrow(
        address _seller,
        address _notary,
        uint _totalAmount
    ) public returns (address escrowContract) {
        require(_seller != address(0), "Invalid seller address");
        require(_notary != address(0), "Invalid notary address");
        require(_totalAmount > 0, "Invalid amount");
        
        // Deploy new escrow contract using new keyword
        NotaryMediatedEscrow newEscrow = new NotaryMediatedEscrow(
            defaultOwners,
            defaultNumConfirmationsRequired,
            sizlandTreasury
        );
        
        escrowContract = address(newEscrow);
        require(escrowContract != address(0), "Failed to create escrow");
        
        // Track the contract
        escrowContracts.push(escrowContract);
        isEscrowContract[escrowContract] = true;
        userEscrows[msg.sender].push(escrowContract);
        
        emit EscrowCreated(escrowContract, msg.sender, _seller, _notary, _totalAmount);
    }
    
    /**
     * @dev Creates multiple escrows for a user (batch creation)
     */
    function createBatchEscrows(
        address[] memory _sellers,
        address[] memory _notaries,
        uint[] memory _totalAmounts
    ) public returns (address[] memory) {
        require(_sellers.length == _notaries.length && _notaries.length == _totalAmounts.length, "Array length mismatch");
        
        address[] memory newEscrows = new address[](_sellers.length);
        
        for (uint i = 0; i < _sellers.length; i++) {
            newEscrows[i] = createEscrow(_sellers[i], _notaries[i], _totalAmounts[i]);
        }
        
        return newEscrows;
    }
    
    /**
     * @dev Get all escrows for a specific user
     */
    function getUserEscrows(address _user) public view returns (address[] memory) {
        return userEscrows[_user];
    }
    
    /**
     * @dev Get all escrow contracts
     */
    function getAllEscrows() public view returns (address[] memory) {
        return escrowContracts;
    }
    
    /**
     * @dev Get escrow count
     */
    function getEscrowCount() public view returns (uint) {
        return escrowContracts.length;
    }
    
    /**
     * @dev Update Doddy's notary address (admin function)
     */
    function updateDoddyNotary(address _newDoddy) public {
        require(msg.sender == doddyNotary || isOwner[msg.sender], "Only Doddy or owner can update");
        require(_newDoddy != address(0), "Invalid address");
        
        address oldDoddy = doddyNotary;
        doddyNotary = _newDoddy;
        
        emit DoddyNotaryUpdated(oldDoddy, _newDoddy);
    }
    
    /**
     * @dev Update default multi-sig owners (admin function)
     */
    function updateDefaultOwners(address[] memory _newOwners) public {
        require(isOwner[msg.sender], "Only owner can update");
        require(_newOwners.length > 0, "Owners required");
        
        defaultOwners = _newOwners;
        emit DefaultOwnersUpdated(_newOwners);
    }
    
    /**
     * @dev Update default confirmations required (admin function)
     */
    function updateDefaultConfirmations(uint _newConfirmations) public {
        require(isOwner[msg.sender], "Only owner can update");
        require(_newConfirmations > 0 && _newConfirmations <= defaultOwners.length, "Invalid confirmations");
        
        defaultNumConfirmationsRequired = _newConfirmations;
        emit DefaultConfirmationsUpdated(_newConfirmations);
    }
    
    /**
     * @dev Check if an address is a valid escrow contract
     */
    function isValidEscrow(address _contract) public view returns (bool) {
        return isEscrowContract[_contract];
    }
    
    /**
     * @dev Get the escrow count for a given escrow contract
     */
    function getEscrowCount(address _escrowContract) 
        public 
        view 
        returns (uint) 
    {
        require(isValidEscrow(_escrowContract), "Invalid escrow contract");
        return NotaryMediatedEscrow(payable(_escrowContract)).escrowCount();
    }
}
