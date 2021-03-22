// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IOLIVOil {
    function mint(address _to, uint256 _id, uint256 _quantity, bytes memory _data) external ;
	function totalSupply(uint256 _id) external view returns (uint256);
    function maxSupply(uint256 _id) external view returns (uint256);
    function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes calldata _data) external;
}