// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IReleaseAuthorizer.sol";

contract MultiSigWallet is ReentrancyGuard {
    event Deposit(address indexed sender, uint256 amount);
    event SubmitTransaction(address indexed owner, uint256 indexed txIndex, address indexed to, uint256 value, bytes data);
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

    struct Transaction { address to; uint256 value; bytes data; bool executed; uint256 numConfirmations; }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;
    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    modifier onlyOwner() { require(isOwner[msg.sender], "not owner"); _; }
    modifier txExists(uint256 i) { require(i < transactions.length, "tx does not exist"); _; }
    modifier notExecuted(uint256 i) { require(!transactions[i].executed, "tx already executed"); _; }
    modifier notConfirmed(uint256 i) { require(!isConfirmed[i][msg.sender], "tx already confirmed"); _; }

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "owners required");
        require(_numConfirmationsRequired > 0 && _numConfirmationsRequired <= _owners.length, "invalid confirmations");
        for (uint256 i = 0; i < _owners.length; i++) {
            address o = _owners[i];
            require(o != address(0) && !isOwner[o], "invalid owner");
            isOwner[o] = true; owners.push(o);
        }
        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable { emit Deposit(msg.sender, msg.value); }

    function _submitAndConfirm(address _to, uint256 _value, bytes memory _data) internal returns (uint256 txIndex) {
        require(_to != address(0), "Invalid destination address");
        txIndex = transactions.length;
        transactions.push(Transaction(_to, _value, _data, false, 0));
        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
        _confirm(txIndex);
    }

    function submitTransaction(address _to, uint256 _value, bytes memory _data) external onlyOwner returns (uint256) {
        return _submitAndConfirm(_to, _value, _data);
    }

    function submitAuthorizedRelease(address _escrow, uint256 _escrowId, address payable _to, uint256 _value, bytes32 _purpose) external onlyOwner returns (uint256 txIndex) {
        require(IReleaseAuthorizer(_escrow).releaseAuthorized(_escrowId, _to, _value, _purpose), "Release not authorized");
        IReleaseAuthorizer(_escrow).consumeRelease(_escrowId, _to, _value, _purpose);
        return _submitAndConfirm(_to, _value, "");
    }

    function _confirm(uint256 _txIndex) internal {
        Transaction storage t = transactions[_txIndex];
        t.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;
        emit ConfirmTransaction(msg.sender, _txIndex);
        if (t.numConfirmations >= numConfirmationsRequired) _run(_txIndex);
    }

    function confirmTransaction(uint256 _txIndex) external onlyOwner txExists(_txIndex) notExecuted(_txIndex) notConfirmed(_txIndex) {
        _confirm(_txIndex);
    }

    function executeTransactionExternal(uint256 _txIndex) external onlyOwner txExists(_txIndex) notExecuted(_txIndex) nonReentrant {
        require(transactions[_txIndex].numConfirmations >= numConfirmationsRequired, "cannot execute tx");
        _run(_txIndex);
    }

    function _run(uint256 _txIndex) internal {
        Transaction storage t = transactions[_txIndex];
        if (t.executed) return;
        require(t.numConfirmations >= numConfirmationsRequired, "cannot execute tx");
        t.executed = true;
        emit ExecuteTransaction(msg.sender, _txIndex);
        (bool ok, ) = t.to.call{value: t.value}(t.data);
        if (!ok) { assembly { returndatacopy(0,0,returndatasize()) revert(0,returndatasize()) } }
    }

    function revokeConfirmation(uint256 _txIndex) external onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");
        transactions[_txIndex].numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;
        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function getOwners() external view returns (address[] memory) { return owners; }
    function getTransactionCount() external view returns (uint256) { return transactions.length; }
    function getTransaction(uint256 i) external view returns (address to,uint256 value,bytes memory data,bool executed,uint256 numConfirmations) {
        Transaction storage t = transactions[i]; return (t.to,t.value,t.data,t.executed,t.numConfirmations);
    }
}
