// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IOLIVOil.sol";


/**
Copyright 2020 PoolTogether Inc.
This file is part of PoolTogether.
PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.
PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * @author Brendan Asselstine
 * @notice A library that uses entropy to select a random number within a bound.  Compensates for modulo bias.
 * @dev Thanks to https://medium.com/hownetworks/dont-waste-cycles-with-modulo-bias-35b6fdafcf94
 */
library UniformRandomNumber {
  /// @notice Select a random number without modulo bias using a random seed and upper bound
  /// @param _entropy The seed for randomness
  /// @param _upperBound The upper bound of the desired number
  /// @return A random number less than the _upperBound
  function uniform(uint256 _entropy, uint256 _upperBound) internal pure returns (uint256) {
    require(_upperBound > 0, "UniformRand/min-bound");
    uint256 min = -_upperBound % _upperBound;
    uint256 random = _entropy;
    while (true) {
      if (random >= min) {
        break;
      }
      random = uint256(keccak256(abi.encodePacked(random)));
    }
    return random % _upperBound;
  }
}

contract Brewer is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Airdrop list
    address[] public airdropList;
    // Only deposit user can get airdrop.
    mapping(address => bool) addressAvailable;
    mapping(address => bool) addressAvailableHistory;

    // Claimable oil of user.
    struct UserOilInfo {
        uint256 amount;
    }
    // Info of each user that claimable oil.
    mapping (address => mapping (uint256 => UserOilInfo)) public userOilInfo;

    // Ticket of users
    mapping(address => uint256) ticketBalances;
    // Info of each oil.
    struct OilInfo {
        uint256 oilID;            // Oil's ID. 
        uint256 amount;            // Distribution amount.
        uint256 fixedPrice;        // Claim the oil need pay some wETH.
    }
    // Info of each oil.
    OilInfo[] public oilInfo;
    // Total oil amount.
    uint256 public totalOilAmount = 0;
    // Original total oil amount.
    uint256 public originalTotalOilAmount = 0;
    // Draw consumption
    uint256 public ticketsConsumed = 1000 * (10 ** 18);
    // Base number
    uint256 public base = 10 ** 6;
    // Claim fee is 3%.
    // Pool's fee 1%. Artist's fee 2%.
    uint256 public totalFee = 3 * (base) / 100;

    // Oil token.
    IOLIVOil OLIVOil;

    event Reward(address indexed user, uint256 indexed oilID);
    event AirDrop(address indexed user, uint256 indexed oilID);

    function oilLength() public view returns (uint256) {
        return oilInfo.length;
    }

    function ticketBalanceOf(address tokenOwner) public view returns (uint256) {
        return ticketBalances[tokenOwner];
    }

    function userOilBalanceOf(address tokenOwner, uint256 _oilID) public view returns (uint256) {
        return userOilInfo[tokenOwner][_oilID].amount;
    }

    function userUnclaimOil(address tokenOwner) public view returns (uint256[] memory) {
        uint256[] memory userOil = new uint256[](oilInfo.length);
        for(uint i = 0; i < oilInfo.length; i++) {
            userOil[i] = userOilInfo[tokenOwner][i].amount;
        }
        return userOil;
    }

    function oilBalanceOf(uint256 _oilID) public view returns (uint256) {
        return oilInfo[_oilID].amount;
    }

    // Add a new oil. Can only be called by the owner.
    function addOil(uint256 _oilID, uint256 _amount, uint256 _fixedPrice) external onlyOwner {
        require(_amount.add(OLIVOil.totalSupply(_oilID)) <= OLIVOil.maxSupply(_oilID), "Max supply reached");
        totalOilAmount = totalOilAmount.add(_amount);
        originalTotalOilAmount = originalTotalOilAmount.add(_amount);
        oilInfo.push(OilInfo({
            oilID: _oilID,
            amount: _amount,
            fixedPrice: _fixedPrice
        }));
    }

    // Update oil.
    // It's always decrease.
    function _updateOil(uint256 _wid, uint256 amount) internal {
        OilInfo storage oil = oilInfo[_wid];
        oil.amount = oil.amount.sub(amount);
        totalOilAmount = totalOilAmount.sub(amount);
    }

    // Update user oil
    function _addUserOil(address user, uint256 _wid, uint256 amount) internal {
        UserOilInfo storage userOil = userOilInfo[user][_wid];
        userOil.amount = userOil.amount.add(amount);
    }
    function _removeUserOil(address user, uint256 _wid, uint256 amount) internal {
        UserOilInfo storage userOil = userOilInfo[user][_wid];
        userOil.amount = userOil.amount.sub(amount);
    }

    // Draw main function
    function _draw() internal view returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encodePacked(now, block.difficulty, msg.sender)));
        uint256 rnd = UniformRandomNumber.uniform(seed, totalOilAmount);
        // Sort by rarity. Avoid gas attacks, start from the tail.
        for(uint i = oilInfo.length - 1; i > 0; --i){
            if(rnd < oilInfo[i].amount){
                return i;
            }
            rnd = rnd - oilInfo[i].amount;
        }
        // should not happen.
        return uint256(-1);
    }

    // Draw a oil
    function draw() external {
        // EOA only
        require(msg.sender == tx.origin);

        require(ticketBalances[msg.sender] >= ticketsConsumed, "Tickets are not enough.");
        ticketBalances[msg.sender] = ticketBalances[msg.sender].sub(ticketsConsumed);

        uint256 _rwid = _draw();
        // Reward reduced
        _updateOil(_rwid, 1);
        _addUserOil(msg.sender, _rwid, 1);

        emit Reward(msg.sender, _rwid);
    }

    // Airdrop by owner
    function airDrop() external onlyOwner {

        uint256 _rwid = _draw();
        // Reward reduced
        _updateOil(_rwid, 1);

        uint256 seed = uint256(keccak256(abi.encodePacked(now, _rwid)));
        bool status = false;
        uint256 rnd = 0;

        while (!status) {
            rnd = UniformRandomNumber.uniform(seed, airdropList.length);
            status = addressAvailable[airdropList[rnd]];
            seed = uint256(keccak256(abi.encodePacked(seed, rnd)));
        }

        _addUserOil(airdropList[rnd], _rwid, 1);
        emit AirDrop(airdropList[rnd], _rwid);
    }

    // Airdrop by user
    function airDropByUser() external {

        // EOA only
        require(msg.sender == tx.origin);

        require(ticketBalances[msg.sender] >= ticketsConsumed, "Tickets are not enough.");
        ticketBalances[msg.sender] = ticketBalances[msg.sender].sub(ticketsConsumed);
        
        uint256 _rwid = _draw();
        // Reward reduced
        _updateOil(_rwid, 1);

        uint256 seed = uint256(keccak256(abi.encodePacked(now, _rwid)));
        bool status = false;
        uint256 rnd = 0;

        while (!status) {
            rnd = UniformRandomNumber.uniform(seed, airdropList.length);
            status = addressAvailable[airdropList[rnd]];
            seed = uint256(keccak256(abi.encodePacked(seed, rnd)));
        }

        _addUserOil(airdropList[rnd], _rwid, 1);
        emit AirDrop(airdropList[rnd], _rwid);
    }

    // pool's fee & artist's fee
    function withdrawFee() external onlyOwner {
        msg.sender.transfer(address(this).balance);
    }

    // Compute claim fee.
    function claimFee(uint256 _wid, uint256 amount) public view returns (uint256){
        OilInfo storage oil = oilInfo[_wid];
        return amount * oil.fixedPrice * (totalFee) / (base);
    }

    // User claim oil.
    function claim(uint256 _wid, uint256 amount) external payable {
        UserOilInfo storage userOil = userOilInfo[msg.sender][_wid];
        require(amount > 0, "amount must not zero");
        require(userOil.amount >= amount, "amount is bad");
        require(msg.value == claimFee(_wid, amount), "need payout claim fee");

        _removeUserOil(msg.sender, _wid, amount);
        OLIVOil.mint(msg.sender, _wid, amount, "");
    }
}


contract BrewMaster is Brewer {
    // Info of each user.
    struct UserLPInfo {
        uint256 amount;       // How many LP tokens the user has provided.
        uint256 rewardTicket; // Reward ticket. 
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;            // Address of LP token contract.
        uint256 allocPoint;        // How many allocation points assigned to this pool. TICKETs to distribute per block.
        uint256 lastRewardBlock;   // Last block number that TICKETs distribution occurs.
        uint256 accTicketPerShare; // Accumulated TICKETs per share, times 1e12. See below.
    }
    // TICKET tokens created per block.
    uint256 public ticketPerBlock;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserLPInfo)) public userLPInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when TICKET mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IOLIVOil _OLIVOil,
        uint256 _ticketPerBlock,
        uint256 _startBlock
    ) public {
        OLIVOil = _OLIVOil;
        ticketPerBlock = _ticketPerBlock;
        startBlock = _startBlock;
        oilInfo.push(OilInfo({
            oilID: 0,
            amount: 0,
            fixedPrice: 0
        }));
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accTicketPerShare: 0
        }));
    }

    // Update the given pool's Tickets allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to.sub(_from);
    }

    // View function to see pending Tickets on frontend.
    function pendingTicket(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserLPInfo storage user = userLPInfo[_pid][_user];
        uint256 accTicketPerShare = pool.accTicketPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 ticketReward = multiplier.mul(ticketPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accTicketPerShare = accTicketPerShare.add(ticketReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accTicketPerShare).div(1e12).sub(user.rewardTicket);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 ticketReward = multiplier.mul(ticketPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accTicketPerShare = pool.accTicketPerShare.add(ticketReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to Brewer for TICKET allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        // EOA only
        require(msg.sender == tx.origin);

        PoolInfo storage pool = poolInfo[_pid];
        UserLPInfo storage user = userLPInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTicketPerShare).div(1e12).sub(user.rewardTicket);
            ticketBalances[msg.sender] = ticketBalances[msg.sender].add(pending);
        }
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        user.amount = user.amount.add(_amount);
        user.rewardTicket = user.amount.mul(pool.accTicketPerShare).div(1e12);
        if (user.amount > 0){
            addressAvailable[msg.sender] = true;
            if(!addressAvailableHistory[msg.sender]){
                addressAvailableHistory[msg.sender] = true;
                airdropList.push(msg.sender);
            }
        }
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from Brewer.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserLPInfo storage user = userLPInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accTicketPerShare).div(1e12).sub(user.rewardTicket);
        ticketBalances[msg.sender] = ticketBalances[msg.sender].add(pending);
        user.amount = user.amount.sub(_amount);
        user.rewardTicket = user.amount.mul(pool.accTicketPerShare).div(1e12);
        pool.lpToken.safeTransfer(address(msg.sender), _amount);
        if (user.amount == 0){
            addressAvailable[msg.sender] = false;
        }
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserLPInfo storage user = userLPInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardTicket = 0;
        addressAvailable[msg.sender] = false;
    }
}