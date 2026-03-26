// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./NotaryMediatedEscrow.sol";

contract EscrowFactory {
    
    address public defaultNotary;
    address[] public escrowContracts;
    mapping(address => bool) public isEscrowContract;
    mapping(address => address[]) public userEscrows;
    
    address public owner;
    mapping(address => bool) public isOwner;
    mapping(address => bool) public isAdmin;
    
    address[] public defaultOwners;
    uint public defaultNumConfirmationsRequired;
    address public treasury;
    
    uint public constant MAX_BATCH_SIZE = 50;
    uint public constant MAX_FACILITATION_FEE_BP = 500;
    
    mapping(bytes32 => uint) public pendingActions;
    uint public actionDelay = 2 days;
    mapping(address => uint) public adminTransfers;
    
    event EscrowCreated(
        address indexed escrowContract,
        address indexed client,
        address indexed seller,
        address notary,
        uint totalAmount
    );
    
    event NotaryUpdated(address oldNotary, address newNotary);
    event DefaultOwnersUpdated(address[] oldOwners, address[] newOwners);
    event DefaultConfirmationsUpdated(uint oldConfirmations, uint newConfirmations);
    event PendingActionCreated(bytes32 actionId, string actionType, uint executeAfter);
    event PendingActionExecuted(bytes32 actionId);
    event PendingActionCancelled(bytes32 actionId);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    
    constructor(
        address _defaultNotary,
        address[] memory _defaultOwners,
        uint _defaultNumConfirmationsRequired,
        address _treasury
    ) {
        require(_defaultNotary != address(0), "Invalid notary address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_defaultOwners.length > 0, "Default owners required");
        require(_defaultNumConfirmationsRequired > 0 && _defaultNumConfirmationsRequired <= _defaultOwners.length, "Invalid confirmations");
        
        owner = msg.sender;
        isOwner[msg.sender] = true;
        
        defaultNotary = _defaultNotary;
        defaultOwners = _defaultOwners;
        defaultNumConfirmationsRequired = _defaultNumConfirmationsRequired;
        treasury = _treasury;
    }
    
    /**
     * @dev Creates a new escrow contract with default notary
     * @param _seller The property seller
     * @param _totalAmount Total purchase amount
     * @return escrowContract The address of the new escrow contract
     */
    function createEscrowWithDefaultNotary(
        address _seller,
        uint _totalAmount
    ) public returns (address escrowContract) {
        return createEscrow(_seller, defaultNotary, _totalAmount);
    }
    
    /**
     * @dev Creates a new escrow contract with custom notary
     * @param _seller The property seller
      * @param _notary The notary (can be default or custom)
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
            treasury
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
        require(_sellers.length <= MAX_BATCH_SIZE, "Batch size exceeds maximum");
        
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
     * @dev Get all escrow contracts with pagination
     * @param _start Starting index
     * @param _limit Maximum number of results
     */
    function getAllEscrows(uint256 _start, uint256 _limit) public view returns (address[] memory) {
        uint256 total = escrowContracts.length;
        if (_start >= total) {
            return new address[](0);
        }
        
        uint256 end = _start + _limit;
        if (end > total) {
            end = total;
        }
        
        uint256 resultLength = end - _start;
        address[] memory result = new address[](resultLength);
        
        for (uint256 i = _start; i < end; i++) {
            result[i - _start] = escrowContracts[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get all escrow contracts (legacy, without pagination)
     */
    function getAllEscrowsLegacy() public view returns (address[] memory) {
        return escrowContracts;
    }
    
    /**
     * @dev Get escrow count
     */
    function getEscrowCount() public view returns (uint) {
        return escrowContracts.length;
    }
    
    /**
     * @dev Update default notary address (admin function with timelock)
     */
    function updateDefaultNotary(address _newNotary) public {
        require(isOwner[msg.sender], "Only owner can update");
        require(_newNotary != address(0), "Invalid address");
        
        bytes32 actionId = keccak256(abi.encodePacked("UPDATE_NOTARY", _newNotary, block.timestamp));
        
        pendingActions[actionId] = block.timestamp + actionDelay;
        emit PendingActionCreated(actionId, "UPDATE_NOTARY", pendingActions[actionId]);
    }
    
    /**
     * @dev Execute pending notary update
     */
    function executePendingNotaryUpdate(address _newNotary) public {
        require(isOwner[msg.sender], "Only owner can execute");
        
        bytes32 actionId = keccak256(abi.encodePacked("UPDATE_NOTARY", _newNotary, uint256(0)));
        require(pendingActions[actionId] != 0 && pendingActions[actionId] <= block.timestamp, "Action not ready");
        
        address oldNotary = defaultNotary;
        defaultNotary = _newNotary;
        delete pendingActions[actionId];
        
        emit NotaryUpdated(oldNotary, _newNotary);
        emit PendingActionExecuted(actionId);
    }
    
    /**
     * @dev Cancel pending action
     */
    function cancelPendingAction(bytes32 _actionId) public {
        require(isOwner[msg.sender], "Only owner can cancel");
        require(pendingActions[_actionId] != 0, "Action not pending");
        
        delete pendingActions[_actionId];
        emit PendingActionCancelled(_actionId);
    }
    
    /**
     * @dev Update default multi-sig owners (admin function)
     */
    function updateDefaultOwners(address[] memory _newOwners) public {
        require(isOwner[msg.sender], "Only owner can update");
        require(_newOwners.length > 0, "Owners required");
        
        address[] memory oldOwners = defaultOwners;
        defaultOwners = _newOwners;
        emit DefaultOwnersUpdated(oldOwners, _newOwners);
    }
    
    /**
     * @dev Update default confirmations required (admin function)
     */
    function updateDefaultConfirmations(uint _newConfirmations) public {
        require(isOwner[msg.sender], "Only owner can update");
        require(_newConfirmations > 0 && _newConfirmations <= defaultOwners.length, "Invalid confirmations");
        
        uint oldConfirmations = defaultNumConfirmationsRequired;
        defaultNumConfirmationsRequired = _newConfirmations;
        emit DefaultConfirmationsUpdated(oldConfirmations, _newConfirmations);
    }
    
    /**
     * @dev Update treasury address (admin function with timelock)
     */
    function updateTreasury(address _newTreasury) public {
        require(isOwner[msg.sender], "Only owner can update");
        require(_newTreasury != address(0), "Invalid treasury address");
        
        bytes32 actionId = keccak256(abi.encodePacked("UPDATE_TREASURY", _newTreasury, block.timestamp));
        
        pendingActions[actionId] = block.timestamp + actionDelay;
        emit PendingActionCreated(actionId, "UPDATE_TREASURY", pendingActions[actionId]);
    }
    
    /**
     * @dev Execute pending treasury update
     */
    function executePendingTreasuryUpdate(address _newTreasury) public {
        require(isOwner[msg.sender], "Only owner can execute");
        
        bytes32 actionId = keccak256(abi.encodePacked("UPDATE_TREASURY", _newTreasury, uint256(0)));
        require(pendingActions[actionId] != 0 && pendingActions[actionId] <= block.timestamp, "Action not ready");
        
        address oldTreasury = treasury;
        treasury = _newTreasury;
        delete pendingActions[actionId];
        
        emit TreasuryUpdated(oldTreasury, _newTreasury);
        emit PendingActionExecuted(actionId);
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
