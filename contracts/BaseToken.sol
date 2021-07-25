pragma solidity 0.7.6;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20PresetMinterPauser } from "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IPriceFeed } from "./interface/IPriceFeed.sol";
import { IIndexPrice } from "./interface/IIndexPrice.sol";

// TODO: maybe we could rename it to VToken or something?
// TODO: only keep what we need in ERC20PresetMinterPauser
contract BaseToken is IIndexPrice, Ownable, ERC20PresetMinterPauser {
    using SafeMath for uint256;
    address public immutable priceFeed;
    uint8 private immutable _priceFeedDecimals;

    constructor(
        string memory nameArg,
        string memory symbolArg,
        address priceFeedArg
    ) ERC20PresetMinterPauser(nameArg, symbolArg) {
        // BT_IA: invalid address
        require(priceFeedArg != address(0), "BT_IA");

        priceFeed = priceFeedArg;
        _priceFeedDecimals = IPriceFeed(priceFeedArg).decimals();
    }

    function setMinter(address minter) external onlyOwner {
        grantRole(MINTER_ROLE, minter);
    }

    function getIndexPrice(uint256 interval) external view override returns (uint256) {
        return _formatDecimals(IPriceFeed(priceFeed).getPrice(interval));
    }

    function _formatDecimals(uint256 _price) internal view returns (uint256) {
        return _price.mul(10**uint256(decimals())).div(10**uint256(_priceFeedDecimals));
    }
}
