// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./CentomilaContractV2.sol";

/**
 * @title StakingContractV2
 * @dev Audit-level staking contract inspired by Synthetix StakingRewards, Aave Staking Module, and Curve Escrow
 * 
 * Features:
 * - Synthetix-style reward calculation and distribution
 * - Aave-style cooldown period and early withdrawal penalty
 * - Curve-style time-weighted staking
 * - Optimized reward pool management
 */
contract StakingContractV2 is ERC1155Holder, AccessControl, ReentrancyGuard {
    using Math for uint256;
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant REWARDS_DISTRIBUTOR_ROLE = keccak256("REWARDS_DISTRIBUTOR_ROLE");
    
    CentomilaContractV2 public centomilaToken;
    
    // Staking parameters
    uint256 public constant APY = 5; // 5% APY
    uint256 public constant MIN_LOCK_PERIOD = 30 days;
    uint256 public constant COOLDOWN_PERIOD = 7 days; // Aave-style cooldown
    uint256 public constant EARLY_WITHDRAWAL_PENALTY = 10; // 10% penalty
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant PRECISION = 1e18;
    
    // Synthetix-style reward tracking
    uint256 public rewardRate; // Rewards per second
    uint256 public periodFinish; // When rewards period ends
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    // Curve-style time-weighted staking
    struct TimeWeightedStake {
        uint256 amount;
        uint256 weightedAmount; // amount * time
        uint256 stakedAt;
        uint256 lastUpdated;
    }
    
    struct Stake {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastClaimedAt;
        uint256 cooldownEndsAt; // Aave-style cooldown
        bool active;
        TimeWeightedStake timeWeighted;
    }
    
    mapping(address => Stake) public stakes;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    
    uint256 public totalStaked;
    uint256 public totalWeightedStake; // For Curve-style calculations
    uint256 public rewardPool;
    uint256 public rewardDuration = 365 days; // Reward period duration
    
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp, bool earlyWithdrawal);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsDeposited(uint256 amount, uint256 newRewardRate);
    event CooldownStarted(address indexed user, uint256 cooldownEndsAt);
    event RewardPeriodUpdated(uint256 periodFinish, uint256 rewardRate);
    
    constructor(address _centomilaToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(REWARDS_DISTRIBUTOR_ROLE, msg.sender);
        centomilaToken = CentomilaContractV2(_centomilaToken);
    }
    
    /**
     * @dev Synthetix-style: Update reward for account
     */
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    
    /**
     * @dev Synthetix-style: Get last time reward is applicable
     */
    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }
    
    /**
     * @dev Synthetix-style: Calculate reward per token
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (
            (lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * PRECISION / totalStaked
        );
    }
    
    /**
     * @dev Synthetix-style: Calculate earned rewards
     */
    function earned(address account) public view returns (uint256) {
        return (
            (stakes[account].amount * (rewardPerToken() - userRewardPerTokenPaid[account])) / PRECISION
        ) + rewards[account];
    }
    
    /**
     * @dev Curve-style: Update time-weighted stake
     */
    function _updateTimeWeightedStake(address user, uint256 newAmount) internal {
        Stake storage userStake = stakes[user];
        TimeWeightedStake storage tw = userStake.timeWeighted;
        
        if (tw.lastUpdated > 0) {
            uint256 timeElapsed = block.timestamp - tw.lastUpdated;
            tw.weightedAmount += tw.amount * timeElapsed;
        }
        
        tw.amount = newAmount;
        tw.lastUpdated = block.timestamp;
        
        if (newAmount == 0) {
            tw.stakedAt = 0;
        } else if (tw.stakedAt == 0) {
            tw.stakedAt = block.timestamp;
        }
    }
    
    /**
     * @dev Stake CENT tokens with time-weighted tracking
     */
    function stake(uint256 amount) 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        require(amount > 0, "Amount must be greater than 0");
        require(
            centomilaToken.balanceOfCENT(msg.sender) >= amount,
            "Insufficient CENT balance"
        );
        
        // Transfer tokens
        centomilaToken.safeTransferFrom(
            msg.sender,
            address(this),
            centomilaToken.CENT_TOKEN_ID(),
            amount,
            ""
        );
        
        Stake storage userStake = stakes[msg.sender];
        
        // Update time-weighted stake
        _updateTimeWeightedStake(msg.sender, userStake.amount + amount);
        
        if (!userStake.active) {
            userStake.stakedAt = block.timestamp;
            userStake.lastClaimedAt = block.timestamp;
            userStake.active = true;
        }
        
        userStake.amount += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Aave-style: Start cooldown period before unstaking
     */
    function startCooldown() external {
        require(stakes[msg.sender].active, "No active stake");
        require(stakes[msg.sender].cooldownEndsAt == 0, "Cooldown already started");
        
        stakes[msg.sender].cooldownEndsAt = block.timestamp + COOLDOWN_PERIOD;
        emit CooldownStarted(msg.sender, stakes[msg.sender].cooldownEndsAt);
    }
    
    /**
     * @dev Unstake with Aave-style cooldown and penalty
     */
    function unstake(uint256 amount) 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.active, "No active stake");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= userStake.amount, "Insufficient staked amount");
        
        bool earlyWithdrawal = false;
        uint256 penalty = 0;
        
        // Check minimum lock period
        if (block.timestamp < userStake.stakedAt + MIN_LOCK_PERIOD) {
            earlyWithdrawal = true;
            penalty = (amount * EARLY_WITHDRAWAL_PENALTY) / 100;
        }
        
        // Aave-style: Check cooldown if not early withdrawal
        if (!earlyWithdrawal && userStake.cooldownEndsAt > 0) {
            require(
                block.timestamp >= userStake.cooldownEndsAt,
                "Cooldown period not ended"
            );
        }
        
        // Claim rewards first
        uint256 pendingRewards = earned(msg.sender);
        if (pendingRewards > 0) {
            _claimRewards(msg.sender, pendingRewards);
        }
        
        // Update time-weighted stake
        _updateTimeWeightedStake(msg.sender, userStake.amount - amount);
        
        userStake.amount -= amount;
        if (userStake.amount == 0) {
            userStake.active = false;
            userStake.cooldownEndsAt = 0;
        }
        
        totalStaked -= amount;
        
        // Calculate amount to return (after penalty)
        uint256 returnAmount = amount - penalty;
        
        // Transfer tokens back
        centomilaToken.safeTransferFrom(
            address(this),
            msg.sender,
            centomilaToken.CENT_TOKEN_ID(),
            returnAmount,
            ""
        );
        
        // If penalty, burn or send to treasury
        if (penalty > 0) {
            // Option: burn penalty or send to treasury
            // For now, we'll keep it in contract as additional reward pool
            rewardPool += penalty;
        }
        
        emit Unstaked(msg.sender, returnAmount, block.timestamp, earlyWithdrawal);
    }
    
    /**
     * @dev Claim rewards (Synthetix-style)
     */
    function claimRewards() 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        require(stakes[msg.sender].active, "No active stake");
        
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        
        rewards[msg.sender] = 0;
        require(rewardPool >= reward, "Insufficient reward pool");
        
        rewardPool -= reward;
        stakes[msg.sender].lastClaimedAt = block.timestamp;
        
        centomilaToken.safeTransferFrom(
            address(this),
            msg.sender,
            centomilaToken.CENT_TOKEN_ID(),
            reward,
            ""
        );
        
        emit RewardsClaimed(msg.sender, reward, block.timestamp);
    }
    
    /**
     * @dev Internal function to claim rewards
     */
    function _claimRewards(address user, uint256 amount) internal {
        require(rewardPool >= amount, "Insufficient reward pool");
        
        rewards[user] = 0;
        rewardPool -= amount;
        stakes[user].lastClaimedAt = block.timestamp;
        
        centomilaToken.safeTransferFrom(
            address(this),
            user,
            centomilaToken.CENT_TOKEN_ID(),
            amount,
            ""
        );
        
        emit RewardsClaimed(user, amount, block.timestamp);
    }
    
    /**
     * @dev Legacy: Calculate rewards using simple APY formula (for backward compatibility)
     */
    function calculateRewards(address user) public view returns (uint256) {
        Stake memory userStake = stakes[user];
        if (!userStake.active || userStake.amount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - userStake.lastClaimedAt;
        return (userStake.amount * APY * timeElapsed) / (100 * SECONDS_PER_YEAR);
    }
    
    /**
     * @dev Get comprehensive stake information
     */
    function getStakeInfo(address user)
        external
        view
        returns (
            uint256 amount,
            uint256 stakedAt,
            uint256 pendingRewards,
            uint256 totalClaimed,
            uint256 cooldownEndsAt,
            uint256 timeWeightedAmount,
            bool canUnstake
        )
    {
        Stake memory userStake = stakes[user];
        return (
            userStake.amount,
            userStake.stakedAt,
            earned(user), // Synthetix-style earned rewards
            rewards[user],
            userStake.cooldownEndsAt,
            userStake.timeWeighted.weightedAmount,
            block.timestamp >= userStake.stakedAt + MIN_LOCK_PERIOD &&
            (userStake.cooldownEndsAt == 0 || block.timestamp >= userStake.cooldownEndsAt)
        );
    }
    
    /**
     * @dev Synthetix-style: Notify reward amount and update reward rate
     */
    function notifyRewardAmount(uint256 reward) 
        external 
        onlyRole(REWARDS_DISTRIBUTOR_ROLE) 
        updateReward(address(0)) 
    {
        require(reward > 0, "Reward must be greater than 0");
        require(
            centomilaToken.balanceOfCENT(msg.sender) >= reward,
            "Insufficient balance"
        );
        
        centomilaToken.safeTransferFrom(
            msg.sender,
            address(this),
            centomilaToken.CENT_TOKEN_ID(),
            reward,
            ""
        );
        
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardDuration;
        }
        
        rewardPool += reward;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardDuration;
        
        emit RewardsDeposited(reward, rewardRate);
        emit RewardPeriodUpdated(periodFinish, rewardRate);
    }
    
    /**
     * @dev Set reward duration (operator only)
     */
    function setRewardDuration(uint256 _rewardDuration) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        require(_rewardDuration > 0, "Duration must be greater than 0");
        require(
            block.timestamp > periodFinish,
            "Previous period must be finished"
        );
        rewardDuration = _rewardDuration;
    }
    
    /**
     * @dev Supports ERC165 interface
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Holder, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

