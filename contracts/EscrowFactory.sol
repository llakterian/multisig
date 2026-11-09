// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./NotaryMediatedEscrow.sol";

contract EscrowFactory {
    address public owner;
    address public defaultNotary;
    address[] public defaultOwners;
    uint256 public defaultNumConfirmationsRequired;
    address public treasury;

    address[] public escrowContracts;
    mapping(address => bool) public isEscrowContract;
    mapping(address => address[]) public userEscrows;

    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public actionDelay = 2 days;

    struct PendingAction {
        uint256 readyAt;
        bytes32 payloadHash;
        bool exists;
    }
    mapping(bytes32 => PendingAction) public pendingActions;

    event EscrowCreated(address indexed escrowContract, address indexed client, address indexed seller, address notary, uint256 totalAmount);
    event ActionScheduled(bytes32 indexed actionId, string actionType, bytes32 payloadHash, uint256 readyAt);
    event ActionExecuted(bytes32 indexed actionId, string actionType);
    event ActionCancelled(bytes32 indexed actionId);
    event DefaultOwnersUpdated(address[] oldOwners, address[] newOwners);
    event DefaultConfirmationsUpdated(uint256 oldConfirmations, uint256 newConfirmations);

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }

    constructor(address _defaultNotary, address[] memory _defaultOwners, uint256 _defaultNumConfirmationsRequired, address _treasury) {
        require(_defaultNotary != address(0), "Invalid notary");
        require(_treasury != address(0), "Invalid treasury");
        require(_defaultOwners.length > 0, "Owners required");
        require(_defaultNumConfirmationsRequired > 0 && _defaultNumConfirmationsRequired <= _defaultOwners.length, "Invalid confirmations");
        owner = msg.sender;
        defaultNotary = _defaultNotary;
        defaultOwners = _defaultOwners;
        defaultNumConfirmationsRequired = _defaultNumConfirmationsRequired;
        treasury = _treasury;
    }

    function createEscrow(address _client, address _seller, address _notary, uint256 _totalAmount) public returns (address escrowContract) {
        require(_client != address(0) && _seller != address(0) && _notary != address(0), "Invalid address");
        require(_totalAmount > 0, "Invalid amount");
        NotaryMediatedEscrow e = new NotaryMediatedEscrow(defaultOwners, defaultNumConfirmationsRequired, treasury, address(this));
        e.initializeEscrow(_client, _seller, _notary, _totalAmount);
        escrowContract = address(e);
        escrowContracts.push(escrowContract);
        isEscrowContract[escrowContract] = true;
        userEscrows[_client].push(escrowContract);
        userEscrows[_seller].push(escrowContract);
        emit EscrowCreated(escrowContract, _client, _seller, _notary, _totalAmount);
    }

    function createEscrowWithDefaultNotary(address _client, address _seller, uint256 _totalAmount) external returns (address) {
        return createEscrow(_client, _seller, defaultNotary, _totalAmount);
    }

    function _schedule(string memory actionType, bytes32 payloadHash) internal returns (bytes32 id) {
        id = keccak256(abi.encodePacked(actionType, payloadHash, address(this)));
        require(!pendingActions[id].exists, "Already pending");
        uint256 readyAt = block.timestamp + actionDelay;
        pendingActions[id] = PendingAction({readyAt: readyAt, payloadHash: payloadHash, exists: true});
        emit ActionScheduled(id, actionType, payloadHash, readyAt);
    }

    function _consume(bytes32 id, string memory actionType, bytes32 payloadHash) internal {
        PendingAction memory a = pendingActions[id];
        require(a.exists, "Not pending");
        require(a.payloadHash == payloadHash, "Payload mismatch");
        require(block.timestamp >= a.readyAt, "Action not ready");
        delete pendingActions[id];
        emit ActionExecuted(id, actionType);
    }

    function scheduleNotaryUpdate(address _newNotary) external onlyOwner returns (bytes32) {
        require(_newNotary != address(0), "Invalid notary");
        return _schedule("UPDATE_NOTARY", keccak256(abi.encodePacked(_newNotary)));
    }
    function executeNotaryUpdate(bytes32 id, address _newNotary) external onlyOwner {
        _consume(id, "UPDATE_NOTARY", keccak256(abi.encodePacked(_newNotary)));
        defaultNotary = _newNotary;
    }

    function scheduleTreasuryUpdate(address _newTreasury) external onlyOwner returns (bytes32) {
        require(_newTreasury != address(0), "Invalid treasury");
        return _schedule("UPDATE_TREASURY", keccak256(abi.encodePacked(_newTreasury)));
    }
    function executeTreasuryUpdate(bytes32 id, address _newTreasury) external onlyOwner {
        _consume(id, "UPDATE_TREASURY", keccak256(abi.encodePacked(_newTreasury)));
        treasury = _newTreasury;
    }

    function cancelAction(bytes32 id) external onlyOwner {
        require(pendingActions[id].exists, "Not pending");
        delete pendingActions[id];
        emit ActionCancelled(id);
    }

    function updateDefaultOwners(address[] memory _newOwners) external onlyOwner {
        require(_newOwners.length > 0, "Owners required");
        address[] memory old = defaultOwners;
        defaultOwners = _newOwners;
        if (defaultNumConfirmationsRequired > _newOwners.length) defaultNumConfirmationsRequired = _newOwners.length;
        emit DefaultOwnersUpdated(old, _newOwners);
    }

    function updateDefaultConfirmations(uint256 _newConfirmations) external onlyOwner {
        require(_newConfirmations > 0 && _newConfirmations <= defaultOwners.length, "Invalid confirmations");
        uint256 old = defaultNumConfirmationsRequired;
        defaultNumConfirmationsRequired = _newConfirmations;
        emit DefaultConfirmationsUpdated(old, _newConfirmations);
    }

    function getUserEscrows(address _user) external view returns (address[] memory) { return userEscrows[_user]; }
    function getAllEscrows(uint256 _start, uint256 _limit) external view returns (address[] memory) {
        uint256 total = escrowContracts.length;
        if (_start >= total) return new address[](0);
        uint256 end = _start + _limit; if (end > total) end = total;
        address[] memory result = new address[](end - _start);
        for (uint256 i = _start; i < end; i++) result[i - _start] = escrowContracts[i];
        return result;
    }
    function getEscrowCount() external view returns (uint256) { return escrowContracts.length; }
    function isValidEscrow(address _c) external view returns (bool) { return isEscrowContract[_c]; }
}
