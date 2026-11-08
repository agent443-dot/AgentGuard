// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// The Foundry cheatcodes these tests use, declared here so the suite needs no library.
interface Vm {
    function createSelectFork(string calldata url, uint256 blockNumber) external returns (uint256);
    function createSelectFork(string calldata url) external returns (uint256);
    function envOr(string calldata name, string calldata fallbackValue) external view returns (string memory);
    function envOr(string calldata name, uint256 fallbackValue) external view returns (uint256);
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
    function toString(bytes32 value) external pure returns (string memory);
}

interface ISafe {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool);
}

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address);
}

interface IAllowanceModule {
    function addDelegate(address delegate) external;
    function removeDelegate(address delegate, bool removeAllowances) external;
    function delegates(address safe, uint48 key) external view returns (address delegate, uint48 prev, uint48 next);
    function setAllowance(address delegate, address token, uint96 amount, uint16 resetTimeMin, uint32 resetBaseMin)
        external;
    function getTokenAllowance(address safe, address delegate, address token)
        external
        view
        returns (uint256[5] memory);
    function executeAllowanceTransfer(
        address safe,
        address token,
        address payable to,
        uint96 amount,
        address paymentToken,
        uint96 payment,
        address delegate,
        bytes memory signature
    ) external;
}

/// A token the Safe holds, so the cap is tested on the module alone and no token address is assumed.
contract TestToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// The four properties SVM-8 proved on Solana, against the official Allowance Module on a Base fork.
contract AllowanceCapTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    // Foundry's console prints to the test output. The address holds no code, so it is called with a
    // low-level staticcall: an interface call would revert on Solidity's code-size check.
    address private constant CONSOLE = 0x000000000000000000636F6e736F6c652e6c6f67;

    // Official deployments: safe-global/safe-deployments v1.4.1 and safe-modules-deployments 0.1.1.
    address private constant SAFE_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    IAllowanceModule private constant MODULE = IAllowanceModule(0xAA46724893dedD72658219405185Fb0Fc91e091C);

    // Pinned so the result cannot drift with the chain (2026-10-25, about). The module is absent at
    // 30,000,000, so a pin older than its deployment fails setUp; re-pin forward if the RPC stops
    // serving this block's state.
    uint256 private constant FORK_BLOCK = 53_000_000;

    uint96 private constant CAP = 100e6;
    uint16 private constant DAY_MIN = 1440;

    address private constant OWNER = address(0x0E0E);
    address payable private constant HOT = payable(address(0xB0B));

    ISafe private safe;
    TestToken private token;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_FORK_RPC_URL", string("https://mainnet.base.org"));
        vm.createSelectFork(rpc, vm.envOr("BASE_FORK_BLOCK", FORK_BLOCK));
        require(SAFE_L2.code.length > 0, "no Safe singleton at the fork block");
        require(PROXY_FACTORY.code.length > 0, "no Safe proxy factory at the fork block");
        require(address(MODULE).code.length > 0, "no Allowance Module at the fork block");

        address[] memory owners = new address[](1);
        owners[0] = OWNER;
        bytes memory init =
            abi.encodeCall(ISafe.setup, (owners, 1, address(0), "", address(0), address(0), 0, payable(address(0))));
        safe = ISafe(ISafeProxyFactory(PROXY_FACTORY).createProxyWithNonce(SAFE_L2, init, 1));

        token = new TestToken();
        token.mint(address(safe), 1_000e6);

        asOwner(address(safe), abi.encodeWithSignature("enableModule(address)", address(MODULE)));
        asOwner(address(MODULE), abi.encodeCall(IAllowanceModule.addDelegate, (HOT)));
        asOwner(
            address(MODULE), abi.encodeCall(IAllowanceModule.setAllowance, (HOT, address(token), CAP, DAY_MIN, 0))
        );
    }

    function test_drawsUpToTheCap() public {
        draw(60e6);
        draw(40e6);
        require(token.balanceOf(HOT) == CAP, "hot wallet should hold exactly the cap");
    }

    function test_refusesOneUnitPastTheCap() public {
        draw(60e6);
        vm.expectRevert();
        this.drawExternal(40e6 + 1);
        require(token.balanceOf(HOT) == 60e6, "a refused draw moved tokens");
    }

    function test_refillsAfterADay() public {
        draw(CAP);
        vm.expectRevert();
        this.drawExternal(1);
        vm.warp(block.timestamp + 1 days + 60);
        draw(CAP);
        require(token.balanceOf(HOT) == 2 * CAP, "the allowance did not refill");
    }

    /// The kill exactly as buildKillTx builds it: one Safe call, removeDelegate(hot, true).
    function test_drawsNothingAfterTheKill() public {
        draw(10e6);
        // getAllowanceState reads this entry, keyed by the address's low 48 bits, to say none.
        (address listed,,) = MODULE.delegates(address(safe), uint48(uint160(HOT)));
        require(listed == HOT, "the hot wallet is not listed as a delegate before the kill");
        asOwner(address(MODULE), abi.encodeCall(IAllowanceModule.removeDelegate, (HOT, true)));
        (listed,,) = MODULE.delegates(address(safe), uint48(uint160(HOT)));
        require(listed == address(0), "the hot wallet is still listed after the kill");
        uint256[5] memory allowance = MODULE.getTokenAllowance(address(safe), HOT, address(token));
        require(allowance[0] == 0, "the allowance survived the kill");
        vm.expectRevert();
        this.drawExternal(1);
        require(token.balanceOf(HOT) == 10e6, "a draw went through after the kill");
    }

    /// Safe's official list has no Base Sepolia entry for the module, but its deterministic address
    /// holds code there. Equal runtime code means the testnet runs exactly what mainnet does.
    function test_moduleOnSepoliaIsTheMainnetCode() public {
        bytes32 mainnet = address(MODULE).codehash;
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_FORK_RPC_URL", string("https://sepolia.base.org")));
        bytes32 sepolia = address(MODULE).codehash;
        log("Allowance Module code hash, Base mainnet:", mainnet);
        log("Allowance Module code hash, Base Sepolia:", sepolia);
        require(sepolia == mainnet, "the module on Base Sepolia is not the mainnet code");
    }

    /// The hash goes out as text in a single log(string), the one console call every forge decodes.
    function log(string memory label, bytes32 value) private view {
        string memory line = string.concat(label, " ", vm.toString(value));
        (bool ok,) = CONSOLE.staticcall(abi.encodeWithSignature("log(string)", line));
        ok;
    }

    /// External so expectRevert can catch the revert of exactly this call.
    function drawExternal(uint96 amount) external {
        draw(amount);
    }

    function draw(uint96 amount) private {
        // An empty signature makes the module authenticate the caller as the delegate.
        vm.prank(HOT);
        MODULE.executeAllowanceTransfer(address(safe), address(token), HOT, amount, address(0), 0, HOT, "");
    }

    /// A Safe transaction from its only owner: with the owner as caller, an "approved hash" signature
    /// (v = 1, r = owner) needs no private key.
    function asOwner(address to, bytes memory data) private {
        bytes memory signature = abi.encodePacked(uint256(uint160(OWNER)), uint256(0), uint8(1));
        vm.prank(OWNER);
        bool ok = safe.execTransaction(to, 0, data, 0, 0, 0, 0, address(0), payable(address(0)), signature);
        require(ok, "safe transaction failed");
    }
}
