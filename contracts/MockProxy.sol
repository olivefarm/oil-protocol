// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract MockProxy {
    /* Authenticated proxies by user. */
    mapping(address => address) public proxies;
}