import { connected } from 'process';
import React from 'react';
import Layout from '../components/Layout';

import useStore, {CONNECTED, CONNECTING, ZERO, SYMBOL, networks, DISCONNECTED, proxy, NETWORK} from '../useStore';
/* import { getApiUrl } from '../util'; */

const ERR_INSTALL 		= '🦊 You must install Metamask into your browser: https://metamask.io/download.html'
const ERR_DISCONNECTED 	= '🦊 walllet disconnected'
const ERR_NOACCOUNTS 	= '🦊 No selected address.'
const ERR_UNKNOWN 		= '🦊 Unknown error'
const ERR_ASKCONNECT 	= '🦊 Connect to Metamask using the button on the top right.'
const ERR_CANCELLED 	= '🦊 You cancelled requested operation.'
const ERR_CHAINID 		= '🦊 Invalid chain id #:chainId'


interface HomeStatus {
	query: string
	loading: boolean
	submitLabel: string
	
	chain: string
	targetChain: string
	token: string
	value: string
	fee: number
	receiveValue: number
}
interface WalletStatus {
	status: string
	address: string
	balance: number
	err: string
}
interface BaseStatus {
	prices: {[chain:string]:number}
	gasPrices: {[chain:string]:number}
	maxGasLimit: number
}

const Home = () => {
	const { L, txs, addTx } = useStore();
	const refMenu = React.useRef<HTMLUListElement>(null)
	const refList = React.useRef<HTMLInputElement>(null)
	const refAmount = React.useRef<HTMLInputElement>(null)

	const [status, setStatus] = React.useState<HomeStatus>({
		loading: false,
		submitLabel:'',
		query: '',
		chain: 'ETH',
		targetChain: SYMBOL,
		token: 'ETH',
		value: '',
		fee: 0,
		receiveValue: 0
	})

	const [walletStatus, setWalletStatus] = React.useState<WalletStatus>({
		status: '',
		address: '',
		balance: 0, // checking | number
		err: '',
	})
	const [base, setBase] = React.useState<BaseStatus>({
		prices: {},
		gasPrices: {},
		maxGasLimit: 0,
	})

	/* const [isPending, setPending] = React.useState(false) */
	
	const set = (attrs:Partial<HomeStatus>) => setStatus({...status, ...attrs})

	const [time, setTime] = React.useState(+new Date())
	const [timeBalance, setTimeBalance] = React.useState(+new Date())
	

	const getInfo = async () => {
		try {
			const res = await fetch(proxy, {
				body:JSON.stringify({
					jsonrpc:	"2.0",
					method: "get-info",
					params: [],
					id: 1
				}),
				headers: {Accept: "application/json","Content-Type": "application/json"},
				method: "POST"
			})
			const json = await res.json()
			console.log(Math.round(+new Date()/1000), json.result)
			setBase(json.result)
			
		} catch (error) {
			console.log(error)
		}
	}

	React.useEffect(() => {
		if (walletStatus.status===CONNECTED && walletStatus.address!=='') {
			getBalance(status.chain, status.token, walletStatus.address).then(balance=>{
				if (typeof balance==="number") setWalletStatus({ ...walletStatus, balance })	
			})
		}
		const timer = setTimeout(()=>setTimeBalance(+new Date()), 10000)
		return ()=>clearTimeout(timer)
	}, [timeBalance, walletStatus.status, status.chain, status.token])
	
	React.useEffect(() => {
		getInfo()
		const timer = setTimeout(()=>setTime(+new Date()), 10000)
		return ()=>clearTimeout(timer)
	}, [time])

	const _connect = async (accounts?:Array<string>)=>{
		const { ethereum } = window
		let err = '';
		try {
			setWalletStatus({...walletStatus, status:CONNECTING, err:''})
			if (ethereum) {
				if (accounts===undefined) accounts = await ethereum.request({method: 'eth_requestAccounts'})
				
				if (accounts && accounts.length) {
					const chainId = await getChainId();
					if (chainId===networks[status.chain].chainId) {
						setWalletStatus({...walletStatus, status:CONNECTED, address:accounts[0], err:''})
						return 
					} else {
						err = ERR_CHAINID.replace(':chainId', String(chainId))	
					}
				} else {
					err = ERR_NOACCOUNTS
				}
			} else {
				err = ERR_INSTALL
			}
		} catch (error:any) {
			err = '🦊 ' + error.message
		}
		setWalletStatus({...walletStatus, status:DISCONNECTED, address:'', err})
    }

    const getChainId = async () => {
		const { ethereum } = window
		if (ethereum) {
			return Number(await ethereum.request({ method: 'eth_chainId' }));
		}
		return 0
	}

	const accountChanged = async (accounts: any) => {
		if (walletStatus.status===CONNECTED) {
			_connect(accounts);
		}
	}

	const chainChanged = async (newChainId) => {
		if (walletStatus.status===CONNECTED) {
			_connect();
		}
	}

    const connect = async (): Promise<void> =>{
		_connect();
    }
	

	/* React.useEffect(()=>{
		checkPending()
	}, [])

	React.useEffect(()=>{
		if (isPending) return;
		let timer;
		try {
			timer = setTimeout(checkPending, 5000)
		} catch (error) {
			console.log(error)
		}
		return ()=>timer && clearTimeout(timer)
	}, [isPending]) */

	React.useEffect(() => {
		if (walletStatus.status===CONNECTED) {
			getChainId().then(chainId=>{
				if (chainId===networks[status.chain].chainId) {
					setWalletStatus({...walletStatus, status:CONNECTED, err:''})
				} else {
					setWalletStatus({...walletStatus, status:DISCONNECTED, err: ERR_DISCONNECTED})
				}
			});
		}
	}, [status.chain])
	
	React.useEffect(() => {
		const { ethereum } = window
		if (ethereum) {
			ethereum.on('accountsChanged', accountChanged)
			ethereum.on('chainChanged', chainChanged)
		}
	})

	const onChangeNetwork = (chain:string)=>{
		// const net = networks[chain];
		// const chainId = net.chainId;
		// const rpc = net.rpc;
		const _chain = status.targetChain===SYMBOL ? 'chain' : 'targetChain'
		const c1 = _chain==='chain' ? chain : status.chain
		const c2 = _chain==='targetChain' ? chain : status.targetChain
		// G.update({[_chain]:chain, chainId, rpc})
		const {receiveValue, fee} = getReceivedValue(c1, c2, status.token, Number(status.value))
		set({ [_chain]:chain, receiveValue, fee })
		if (refMenu && refMenu.current) {
			refMenu.current.style.display = 'none'
			setTimeout(()=>(refMenu && refMenu.current && (refMenu.current.style.display = '')), 100)
		}
	}

	const addNetwork = () => {
		const { ethereum, ethers } = window
		if (ethereum) {
			ethereum.request({
				method: 'wallet_addEthereumChain',
				params: [{
					chainId: ethers.utils.hexlify(networks[SYMBOL].chainId),
					chainName: L['chain.' + SYMBOL.toLowerCase()],
					nativeCurrency: {
						name: NETWORK,
						symbol: SYMBOL,
						decimals: 18
					},
					rpcUrls: [networks[SYMBOL].rpc],
					blockExplorerUrls: [networks[SYMBOL].explorer]
				}]
			}).catch((error) => {
				console.log(error)
			}) 
		}
	}
	const swapChains = () => {
		const {receiveValue, fee} = getReceivedValue(status.targetChain, status.chain, status.token, Number(status.value))
		set({chain:status.targetChain, targetChain:status.chain, receiveValue, fee}) // , /* token, */ chainId, rpc
	}

	const checkTxs = async () => {
		// try {
		// 	if (!isPending) {
		// 		setPending(true)
		// 		const params1:{[chainId:string]:Array<string>} = {};
		// 		const params2:Array<string> = [];
		// 		for(let k in G.pending) {
		// 			const v = G.pending[k]
		// 			const confirmations = txs[k]?.confirmations || 0
		// 			if (networks[v.chain].confirmations > confirmations) {
		// 				if (params1[v.chain]===undefined) params1[v.chain] = []
		// 				params1[v.chain].push(k)
		// 			} else {
		// 				if (txs[k] && !txs[k].err && !txs[k].tx) params2.push(k)
		// 			}
		// 		}
		// 		if (Object.keys(params1).length) {
		// 			const res = await Promise.all(Object.keys(params1).map(k=>G.check(k, params1[k])))
		// 			const txs:TxTypes = {...txs}
		// 			const now = Math.round(new Date().getTime() / 1000)
		// 			for(let v of res) {
		// 				if (v) {
		// 					for(let k in v) {
		// 						if (v[k]===-1) {
		// 							if (now - G.pending[k].created > 600) txs[k] = {...txs[k], err:true}
		// 						} else {
		// 							txs[k] = {...txs[k], confirmations:v[k]}
		// 						}
		// 					}
		// 				}
		// 			}
		// 			G.setTxs(txs)
		// 		}
		// 		if (params2.length) {
		// 			// const rows = await request('/get-txs', params2)
		// 			// if (rows && Array.isArray(rows)) {
		// 			// 	const now = Math.round(new Date().getTime() / 1000)
		// 			// 	const txs:TxTypes = {...txs}
		// 			// 	for(let v of rows) {
		// 			// 		if (v.tx || (v.err && now - G.pending[v.key].created > 600)) {
		// 			// 			txs[v.key] = {...txs[v.key], tx:v.tx, err:v.err, fee:v.fee}
		// 			// 		}
		// 			// 	}
		// 			// 	G.setTxs(txs)
		// 			// }
		// 		}
		// 		setPending(false)
		// 	}
		// } catch (err) {
		// 	console.log(err)
		// }
	}

	const onChangeQuery = (query:string)=>{
		set({query})
	}

	const onChangeToken = (token:string)=>{
		const {receiveValue, fee} = getReceivedValue(status.chain, status.targetChain, token, Number(status.value))
		set({token, receiveValue, fee})
		if (refList && refList.current) {
			refList.current.checked = false
		}
	}

	const getReceivedValue = (chain:string, targetChain:string, token:string, amount: number) => {
		if (base.gasPrices[chain]!==undefined) {
			const feeEther = base.maxGasLimit * base.gasPrices[chain] / 1e9
			const decimals = networks[targetChain].tokens[token].decimals
			const fee = Number((feeEther * base.prices[targetChain] / base.prices[token]).toFixed(decimals<6 ? decimals : 6))
			if (amount > fee) {
				const receiveValue = Number((amount - fee).toFixed(decimals<6 ? decimals : 6))
				return {receiveValue, fee}
			}
			return {receiveValue: 0, fee}
		}
		return {receiveValue: 0, fee: 0}
	}

	const onChangeValue = (value:string)=>{
		const {receiveValue, fee} = getReceivedValue(status.chain, status.targetChain, status.token, Number(value))
		set({value, receiveValue, fee})
	}

	const getBalance = async (chain:string, token:string, address:string): Promise<number> => {
		const net = networks[chain]
		const { ethers } = window
		const provider = new ethers.providers.JsonRpcProvider(net.rpc)
		let value = 0;
		if (net.tokens[token].contract===undefined) {
			value = await provider.getBalance(address)
		} else {
			const contract = new ethers.Contract(net.tokens[token].contract, ["function balanceOf(address account) public view returns (uint256)"], provider)
			value = await contract.balanceOf(address)
		}
		const decimals = net.tokens[token].decimals
		return Number(Number(ethers.utils.formatUnits(value, decimals)).toFixed(decimals>6 ? 6 : decimals))
	}

	const waitTx = async (chain:string, txid:string) => {
		const { ethers } = window
		const net = networks[chain]
		const provider = new ethers.providers.JsonRpcProvider(net.rpc)
		let k = 0;
		while(++k<100) {
			const tx = await provider.getTransactionReceipt(txid);
			if (tx && tx.blockNumber) return true;
			await new Promise(resolve=>setTimeout(resolve, 5000))
		}
		return false
	}

	const submit = async ()=>{
		try {
			if (walletStatus.status===CONNECTED) {
				const net = networks[status.chain]
				const token = net.tokens[status.token]
				const targetNet = networks[status.targetChain]
				const amount = Number(status.value)
				set({loading:true, submitLabel:'checking balance...'})
				const balance = await getBalance(status.chain, status.token, walletStatus.address)
				if (amount > balance) {
					refAmount?.current?.focus()
					setWalletStatus({...walletStatus, err:"You haven't enough balance"})
					set({loading:false, submitLabel:'SUBMIT'})
					return
				}
				if (status.targetChain!==SYMBOL && !targetNet.tokens[status.token].pegging) {
					set({loading:true, submitLabel:'checking store balance...'})
					const storeBalance = await getBalance(status.targetChain, status.token, targetNet.bridge)
					if (amount > storeBalance) {
						setWalletStatus({...walletStatus, err:"Sorry, there is not enough balance in the bridge store."})
						set({loading:false, submitLabel:'SUBMIT'})
						return
					}
				}
				if (token && amount>0) {
					const { ethers, ethereum } = window
					const provider = new ethers.providers.Web3Provider(ethereum);
					const contract = new ethers.Contract(net.bridge, [
						"function deposit(address target, address token, uint amount, uint targetChain) external payable"
					], provider)

					const value = ethers.utils.parseUnits(status.value, token.decimals)
					const created = Math.round(new Date().getTime()/1000)
					const target = walletStatus.address
					if (token.contract!==undefined) { // if it is token, need to approve 
						const tokenContract = new ethers.Contract(token.contract, [
							"function allowance(address account, address spender) public view returns (uint256)",
							"function approve(address spender, uint256 amount) public returns (bool)"
						], provider)
						set({loading:true, submitLabel:'checking allowance...'})
						const approval = await tokenContract.allowance(walletStatus.address, net.bridge)
						if (approval.lt(value)) {
							set({loading:true, submitLabel:'approve bridge...'})
							const unsignedTx = await tokenContract.populateTransaction.approve(net.bridge, value.toHexString());
							const tx = {
								...unsignedTx,
								from: walletStatus.address,
								value: '0x00',
								chainId: ethers.utils.hexlify(net.chainId), // Used to prevent transaction reuse across blockchains. Auto-filled by MetaMask.
							};
							const txHash = await ethereum.request({
								method: 'eth_sendTransaction',
								params: [tx],
							});
							await waitTx(status.chain, txHash)
						}
						set({loading:true, submitLabel:'depositing...'})
						const unsignedTx = await contract.populateTransaction.deposit(target, token.contract, value.toHexString(), targetNet.chainId);
						const tx = {
							...unsignedTx,
							from: walletStatus.address,
							value: '0x00',
							chainId: ethers.utils.hexlify(net.chainId),
						};
						const txId = await ethereum.request({
							method: 'eth_sendTransaction',
							params: [tx],
						});
						addTx({txId, chain:status.chain, targetChain:status.targetChain, address:walletStatus.address, token:status.token, value:Number(status.value), updated:0, created})
						await waitTx(status.chain, txId)
					} else {  // if it is token, need to approve 
						set({loading:true, submitLabel:'depositing...'})
						const unsignedTx = await contract.populateTransaction.deposit(target, ZERO, value.toHexString(), targetNet.chainId);
						const tx = {
							...unsignedTx,
							from: walletStatus.address,
							value:value.toHexString(),
							chainId: ethers.utils.hexlify(net.chainId),
						};
						const txId = await ethereum.request({
							method: 'eth_sendTransaction',
							params: [tx],
						});
						addTx({txId, chain:status.chain, targetChain:status.targetChain, address:walletStatus.address, token:status.token, value:Number(status.value), updated:0, created})
						await waitTx(status.chain, txId)
					}
				} else if (refAmount?.current) {
					refAmount.current.focus()
				}
				set({loading:false})
			} else {
				connect()
			}
		} catch (error:any) {
			if (error.code===4001) {
				setWalletStatus({...walletStatus, err:ERR_CANCELLED})
			} else {
				setWalletStatus({...walletStatus, err:error.message})
			}
			set({loading:false})
		}
	}

	const renderNetwork = (chain) => {
		return (chain===SYMBOL) ? (
			<div className="chain flex">
				<img className="icon" src="/logo.svg" alt={SYMBOL}  />
				<div style={{marginTop:10}}>{L['chain.' +  + SYMBOL.toLowerCase()]}</div>
			</div>
		) : (
			<div className="chain">
				<img className="icon" src={`/networks/${chain}.svg`}  alt={chain}/>
				<div className="flex" style={{marginTop:10}}>
					<div className="fill">{L['chain.' + chain.toLowerCase()]}</div>
					<div>
						<div className="menu">
							<i><span className="ic-down"></span></i>
							<ul ref={refMenu} className={status.chain===SYMBOL ? 'right' : ''} style={{width:150}}>
								{Object.keys(networks).map(k=>
									k===SYMBOL ? null : (<li key={k}  onClick={()=>onChangeNetwork(k)}>
										<img className="icon" src={k===SYMBOL ? `/logo.svg` : `/networks/${k}.svg`} alt="eth"/>
										<span>{L['chain.' + k.toLowerCase()]}</span>
									</li>)
								)}
							</ul>
						</div>
					</div>
				</div>
			</div>
		)
	}

	const pendingTxs:Array<any> = []; 
	const targetToken = networks[status.targetChain].tokens[status.token]
	const supported = targetToken!==undefined
	
	// const status.chain = status.chain
	const network = networks[status.chain]
	const erc20 = network.erc20;
	const tokens = network.tokens
	const query = status.query.toLowerCase();
	
	
	// for(let k in G.pending) {
	// 	pendingTxs.push({key:k, ...G.pending[k]})
	// }
	// pendingTxs.sort((a,b)=>b.created - a.created)

	
	return <Layout className="home">
		<section>
			<div className="c4 o1-md">
				<div className="panel">
					<h1 className="gray">{L['bridge']}</h1>
					<p className="gray">{L['description']}</p>
					{/* <div className="mt4 mb-3"><a href="/" className="button">Introduction video</a></div>
					<p><a className="cmd" href="/">View Proof of Assets</a></p>
					<p><a className="cmd" href="/">User Guide</a></p> */}
					<div className="hide-md" style={{marginTop:20}}>
						<img src="/logo.svg" alt="logo" style={{width:'100%', opacity:0.3}} />
					</div>
				</div>
			</div>
			<div className="c ml3-md">
				<div className="panel swap">
				<p className="gray">If you have not add {NETWORK} network in your MetaMask yet, please click <span className="cmd" onClick={addNetwork}>Add network</span> and continue</p>
					<div className="flex">
						<div className="c">
							{renderNetwork(status.chain)}
						</div>
						<div className="flex middle center" style={{paddingLeft:20, paddingRight:20}}>
							<button className="button switch" onClick={()=>swapChains()}>
								<svg fill="white" width="18" viewBox="0 0 18 18"><path d="M10.47 1L9.06 2.41l5.1 5.1H0V9.5h14.15l-5.09 5.09L10.47 16l7.5-7.5-7.5-7.5z"></path></svg>
							</button>
						</div>
						<div className="c">
							{renderNetwork(status.targetChain)}
						</div>
					</div>
					<div className="label" style={{paddingTop:30}}>Asset</div>
					<div className="asset">
						<input ref={refList} id="asset" type="checkbox" style={{display:'none'}} />
						<label className="asset" htmlFor="asset" style={{ cursor:'pointer' }}>
							<div className="flex">
								<img src={status.token===status.chain ? `/networks/${status.chain}.svg` : `/coins/${status.token}.svg`} style={{width:20, height:20, marginRight:10}} alt={status.token} />
								<span>{status.token} <small>({status.token===status.chain ? L['token.native'] : erc20})</small></span>
							</div>
							<div>
								<svg width="11" fill="#888" viewBox="0 0 11 11"><path d="M6.431 5.25L2.166 9.581l.918.919 5.25-5.25L3.084 0l-.918.919L6.43 5.25z"></path></svg>
							</div>
						</label>
						
						<div className="list">
							<div className="search">
								<svg width="24" height="24" fill="#5e6673" viewBox="0 0 24 24"><path d="M3 10.982c0 3.845 3.137 6.982 6.982 6.982 1.518 0 3.036-.506 4.149-1.416L18.583 21 20 19.583l-4.452-4.452c.81-1.113 1.416-2.631 1.416-4.149 0-1.922-.81-3.643-2.023-4.958C13.726 4.81 11.905 4 9.982 4 6.137 4 3 7.137 3 10.982zM13.423 7.44a4.819 4.819 0 011.416 3.441c0 1.315-.506 2.53-1.416 3.44a4.819 4.819 0 01-3.44 1.417 4.819 4.819 0 01-3.441-1.417c-1.012-.81-1.518-2.023-1.518-3.339 0-1.315.506-2.53 1.416-3.44.911-1.012 2.227-1.518 3.542-1.518 1.316 0 2.53.506 3.44 1.416z"></path></svg>
								<input type="text" value={status.query} maxLength={6} onChange={(e)=>onChangeQuery(e.target.value.trim())} />
							</div>
							<div style={{overflowY: 'auto', maxHeight: 200, boxShadow: '0 3px 5px #000'}}>
								<ul>
									{Object.keys(tokens).map(k=>
										<li key={k} onClick={()=>onChangeToken(k)}>
											<img src={k===status.chain ? `/networks/${status.chain}.svg` : `/coins/${k}.svg`} loading='lazy' style={{width:20, height:20, marginRight:10}} alt={k} />
											<span>{k}</span>
											<small>{k===status.chain ? L['token.native'] : erc20}</small>
										</li>
									)}
								</ul>
							</div>
						</div>
						<label className="overlay" htmlFor="asset"></label>
					</div>
					{!supported ? (
						<p style={{color:'red', backgroundColor: '#2b2f36', padding: 10}}>{`We do not support ${L['chain.' + status.targetChain.toLowerCase()]}'s ${status.token} swap now.`}</p>
					) : null}
					<div className="label" style={{paddingTop:20, display:'flex', justifyContent:'space-between'}}>
						<span>Amount</span>
						{walletStatus.status===CONNECTED && (
							<div style={{ display:'flex', gap:10 }}>
								<span className='cmd'>MAX</span>
								<span style={{color: '#aaa'}}>{walletStatus.balance} {status.token==='-' ? status.chain : status.token}</span>
							</div>
						)}
					</div>
					<div>
						<input disabled={!supported} ref={refAmount} className="amount" type="number" value={status.value} onChange={(e)=>onChangeValue(e.target.value)} />
					</div>

					{status.value!=='' && targetToken ? (
						<p className="gray">You will receive ≈ {status.receiveValue} {status.token==='-' ? status.chain : status.token} <small>({targetToken.contract===undefined ? 'native token' : networks[status.targetChain].erc20})</small>, network fee ≈ {status.fee}</p>
					) : null}
					<div style={{paddingTop:20}}>
						<button disabled={status.loading || !supported} className="primary full" onClick={submit}>
							{status.loading ? (
								<div className="flex middle">
									<div style={{width:'1.5em'}}>
										<div className="loader">Loading...</div>
									</div>
									<div>{status.submitLabel}</div>
								</div>) : (walletStatus.status===CONNECTED ? 'SUBMIT' : 'Connect wallet')
							}
						</button>
						
						{walletStatus.err ? (
							<p style={{color:'red', backgroundColor: '#2b2f36', padding: 10}}>{walletStatus.err}</p>
						) : (
							<p style={{color:'#35ff35'}}>{walletStatus.address ? 'Your wallet: ' + walletStatus.address.slice(0,20) + '...' + walletStatus.address.slice(-8) : ''}</p>
						)}
					</div>
					{txs.length ? (
						<div style={{paddingTop:20}}>
							<p><b className="label">Recent transactions:</b></p>
							<div style={{maxHeight:300, overflowY:'auto'}}>
							{txs.map((v,k)=>(
								<div className={"tx flex" + (v.receivedAmount===undefined ? ' pending' : '')} key={k}>
									<div className="c1">
										<img src={`/networks/${v.chain}.svg`} style={{width:16, height:16, marginRight:5}} alt={v.chain} />
										<span>To</span>
										<img src={`/networks/${v.targetChain}.svg`} style={{width:16, height:16, marginLeft:5}} alt={v.targetChain} />
									</div>
									<code className="c2"><a className="cmd" href={networks[v.chain].explorer + '/tx/' + v.txId} target="_blank" rel="noreferrer" >{v.txId.slice(0,10) + '...' + v.txId.slice(-4)}</a></code>
									<code className="c3">
										<img src={`/coins/${v.token}.svg`} loading='lazy' style={{width:20, height:20, marginRight:5}} alt={v.token} />
										<span>{v.value}</span>
									</code>
									{/* <div className="c4" style={{textAlign:"right"}}>
										{v.receivedAmount===undefined && <code style={{color:'#76808f'}}>confirming...</code>}
									</div> */}
								</div>
							))}
							</div>
						</div>
					) : null}
				</div>
			</div>
		</section>
	</Layout>;
};

export default Home;