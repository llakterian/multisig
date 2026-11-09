// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IReleaseAuthorizer {
    function releaseAuthorized(uint256 escrowId, address to, uint256 amount, bytes32 purpose) external view returns (bool);
    function consumeRelease(uint256 escrowId, address to, uint256 amount, bytes32 purpose) external;
}
