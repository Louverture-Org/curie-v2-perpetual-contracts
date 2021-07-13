import { MockContract } from "@eth-optimism/smock"
import { expect } from "chai"
import { parseEther, parseUnits } from "ethers/lib/utils"
import { waffle } from "hardhat"
import { ClearingHouse, TestERC20, UniswapV3Pool } from "../../typechain"
import { toWei } from "../helper/number"
import { encodePriceSqrt } from "../shared/utilities"
import { BaseQuoteOrdering, createClearingHouseFixture } from "./fixtures"

describe("ClearingHouse getTotalMarketPnl", () => {
    const [admin, maker, taker, taker2] = waffle.provider.getWallets()
    const loadFixture: ReturnType<typeof waffle.createFixtureLoader> = waffle.createFixtureLoader([admin])
    let clearingHouse: ClearingHouse
    let collateral: TestERC20
    let baseToken: TestERC20
    let quoteToken: TestERC20
    let pool: UniswapV3Pool
    let mockedBaseAggregator: MockContract
    let collateralDecimals: number
    const lowerTick: number = 0
    const upperTick: number = 100000

    beforeEach(async () => {
        const _clearingHouseFixture = await loadFixture(createClearingHouseFixture(BaseQuoteOrdering.BASE_0_QUOTE_1))
        clearingHouse = _clearingHouseFixture.clearingHouse
        collateral = _clearingHouseFixture.USDC
        baseToken = _clearingHouseFixture.baseToken
        quoteToken = _clearingHouseFixture.quoteToken
        mockedBaseAggregator = _clearingHouseFixture.mockedBaseAggregator
        pool = _clearingHouseFixture.pool
        collateralDecimals = await collateral.decimals()

        mockedBaseAggregator.smocked.latestRoundData.will.return.with(async () => {
            return [0, parseUnits("100", 6), 0, 0, 0]
        })

        // add pool
        await clearingHouse.addPool(baseToken.address, 10000)
        await pool.initialize(encodePriceSqrt("100", "1"))

        // prepare collateral for maker
        const makerCollateralAmount = toWei(1000000, collateralDecimals)
        await collateral.mint(maker.address, makerCollateralAmount)
        await collateral.connect(maker).approve(clearingHouse.address, makerCollateralAmount)
        await clearingHouse.connect(maker).deposit(makerCollateralAmount)

        // maker add liquidity
        await clearingHouse.connect(maker).mint(baseToken.address, toWei(10000))
        await clearingHouse.connect(maker).mint(quoteToken.address, toWei(10000))
        await clearingHouse.connect(maker).addLiquidity({
            baseToken: baseToken.address,
            base: toWei(100),
            quote: toWei(10000),
            lowerTick,
            upperTick,
        })

        // prepare collateral for taker
        const takerCollateral = toWei(10000, collateralDecimals)
        await collateral.mint(taker.address, takerCollateral)
        await collateral.connect(taker).approve(clearingHouse.address, takerCollateral)
        await clearingHouse.connect(taker).deposit(takerCollateral)

        // taker1 open a long position
        await clearingHouse.connect(taker).openPosition({
            baseToken: baseToken.address,
            isBaseToQuote: false,
            isExactInput: true,
            amount: parseEther("100"),
            sqrtPriceLimitX96: 0,
        })
        // price after swap: 101.8550797108
        // position size = 0.980943170969551031
        // position value = 0.980943170969551031 * 101.8550797 = 99.9140448603
        // cost basis = -100
        // pnl = -100 + 99.9140448603 = -0.0859551397
        expect(await clearingHouse.getTotalMarketPnl(taker.address)).to.eq("-85955129155713749")

        // prepare collateral for taker2
        await collateral.mint(taker2.address, takerCollateral)
        await collateral.connect(taker2).approve(clearingHouse.address, takerCollateral)
        await clearingHouse.connect(taker2).deposit(takerCollateral)
    })

    it("taker open a position and pnl is positive", async () => {
        // taker2 open a long position
        await clearingHouse.connect(taker2).openPosition({
            baseToken: baseToken.address,
            isBaseToQuote: false,
            isExactInput: true,
            amount: parseEther("100"),
            sqrtPriceLimitX96: 0,
        })

        const sqrtPrice = await clearingHouse.getSqrtMarkPriceX96(baseToken.address)
        console.log("sqrt", sqrtPrice.toString())

        // price after swap: 103.7272082538
        // taker1
        // position value = 0.980943170969551031 * 103.7272082538 = 101.7504965803
        // pnl = -100 + 101.7504965803 = 1.7504965803
        expect(await clearingHouse.getTotalMarketPnl(taker.address)).to.eq("1750496580332248211")
    })

    it("taker open a position and pnl is negative", async () => {})
})
