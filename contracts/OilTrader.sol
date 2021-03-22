// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IOLIVOil.sol";

/**
 * @title OilTrade
 */

contract OilTrader {
    using SafeMath for uint256;
    // Oil token.
    IOLIVOil OLIVOil;
    address payable public dev;

    // Info of each order.
    struct OilOrderInfo {
        address payable owner; // owner
        uint256 price; // price 
        uint256 oilID; // oilID
        bool isOpen; // open order
    }

    // Info of each order list.
    OilOrderInfo[] public orderList;

    uint256 private _currentOrderID = 0;

    event Order(uint256 indexed orderID, address indexed user, uint256 indexed wid, uint256 price);
    event Cancel(uint256 indexed orderID, address indexed user, uint256 indexed wid);
    event Buy(uint256 indexed orderID, address indexed user, uint256 indexed wid);

    constructor(
        IOLIVOil _OLIVOil
    ) public {
        OLIVOil = _OLIVOil;
        dev = msg.sender;
        orderList.push(OilOrderInfo({
            owner: address(0),
            price: 0,
            oilID: 0,
            isOpen: false
        }));
    }

    function withdrawFee() external {
        require(msg.sender == dev, "only dev");
        dev.transfer(address(this).balance);
    }

    function orderOil(uint256 _oilID, uint256 _price) external {
        // transferFrom
        OLIVOil.safeTransferFrom(msg.sender, address(this), _oilID, 1, "");

        orderList.push(OilOrderInfo({
            owner: msg.sender,
            price: _price,
            oilID: _oilID,
            isOpen: true
        }));

        uint256 _id = _getNextOrderID();
        _incrementOrderId();

        emit Order(_id, msg.sender, _oilID, _price);

    }

    function cancel(uint256 orderID) external {
        OilOrderInfo storage orderInfo = orderList[orderID];
        require(orderInfo.owner == msg.sender, "not your order");
        require(orderInfo.isOpen == true, "only open order can be cancel");

        orderInfo.isOpen = false;

        // transferFrom
        OLIVOil.safeTransferFrom(address(this), msg.sender, orderInfo.oilID, 1, "");

        emit Cancel(orderID, msg.sender, orderInfo.oilID);

    }

    function buyOil(uint256 orderID) external payable {
        OilOrderInfo storage orderInfo = orderList[orderID];
        require(orderInfo.owner != address(0),"bad address");
        require(orderInfo.owner != msg.sender, "it is your order");
        require(orderInfo.isOpen == true, "only open order can buy");
        require(msg.value == orderInfo.price, "error price");

        // 3% fee
        uint256 sellerValue = msg.value.mul(97).div(100);
        orderInfo.isOpen = false;

        // transferFrom
        OLIVOil.safeTransferFrom(address(this), msg.sender, orderInfo.oilID, 1, "");
        orderInfo.owner.transfer(sellerValue);
        emit Buy(orderID, msg.sender, orderInfo.oilID);
    }

	function _getNextOrderID() private view returns (uint256) {
		return _currentOrderID.add(1);
	}
	function _incrementOrderId() private {
		_currentOrderID++;
	}

    function onERC1155Received(address _operator, address _from, uint256 _id, uint256 _value, bytes calldata _data) external returns(bytes4){
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }
}