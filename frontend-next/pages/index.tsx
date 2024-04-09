import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Game from "@/components/game";
import { ethers, HDNodeWallet, Wallet } from 'ethers';
import { recieveSOL, sendSOL } from '@/components/utils';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
require('@solana/wallet-adapter-react-ui/styles.css');
const WalletDisconnectButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletDisconnectButton,
  { ssr: false }
);
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletConnectButton,
  { ssr: false }
);
let socket: Socket; // URL of your signaling server
let dataChannel: RTCDataChannel;
let wallet: HDNodeWallet;
export type Block = {
  num: number;
  data: string;
  timestamp: number;
};
export type BlockData = {
  // add lastBlock: Block;
  type: string;
  block: string;
  // hash: string
  sig1: string;
  pub1: string;
  pub2: string;
  sig2: string;
};
let ran = 0;
let playerNum: 1 | 2 = 1;
let canvas: HTMLCanvasElement;
let width: number, height: number;
let ctx: CanvasRenderingContext2D;
let game: Game;
let backgroundImage: HTMLImageElement;
let blockNum = 0;
let lastSignedBlock: Block;
let mousePos: [number, number] = [0, 0];
export default function App() {
  const [localPeerId, setLocalPeerId] = useState('');
  const localPeer = useRef<RTCPeerConnection>();
  const [remotePeerId, setRemotePeerId] = useState('');
  const [message, setMessage] = useState<string>("");
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [paid, setPaid] = useState<boolean>(false);
  const [calling, setCalling] = useState<boolean>(false);
  const solwallet = useWallet();
  useEffect(() => {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL!);
    socket.on('connect', () => {
      console.log(socket.id);
      setLocalPeerId(socket.id!);
    });
    console.log(process.env.NEXT_PUBLIC_BACKEND_URL!);
    // blah
    let _wallet = Wallet.createRandom();
    wallet = _wallet;
    // Initialize peer connection
    localPeer.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    dataChannel = localPeer.current.createDataChannel("data");
    dataChannel.onopen = () => console.log("data channel opened");
    dataChannel.onerror = console.error;
    dataChannel.onmessage = receiveMessage;
    localPeer.current.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.onmessage = receiveMessage;
      receiveChannel.onopen = () => {
        console.log(`Data channel recieved! I am ${playerNum}`);
        serializeSignAndSend();
      };
      receiveChannel.onclose = () => console.log("Data channel closed");
    };
    // Listen for ICE candidates and send them to the peer
    localPeer.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("received candidate");
        socket.emit('candidate', { candidate: event.candidate, to: remotePeerId });
      }
    };

    // Handle receiving offers
    socket.on('offer', async ({ offer, from }) => {
      console.log("received offer");
      // if (!solwallet.connected) {
      //   alert("connect your wallet!");
      //   return;
      // }
      // await recieveSOL(solwallet.publicKey!.toString(), 0.01, solwallet.signTransaction!);
      if (!localPeer.current) return;
      setRemotePeerId(from);
      await localPeer.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await localPeer.current.createAnswer();
      await localPeer.current.setLocalDescription(answer);
      socket.emit('answer', { answer, to: from });
      playerNum = 2;
    });

    // Handle receiving answers
    socket.on('answer', async ({ answer }) => {
      console.log("received answer");
      if (!localPeer.current) return;
      const remoteDesc = new RTCSessionDescription(answer);
      await localPeer.current.setRemoteDescription(remoteDesc);
      playerNum = 1;
      // playernum is 1, so I am player 1, so I request the chain's data
    });

    // Handle receiving ICE candidates
    socket.on('candidate', async ({ candidate }) => {
      if (!localPeer.current) return;
      await localPeer.current.addIceCandidate(new RTCIceCandidate(candidate));
    });
    socket.on("player", (s) => {
      console.log(s);
      setPeerIds(s);
      //setRemotePeerId(s);
    });
    socket.on("data", (data) => {
      receiveMessage({ data });
    });
    return () => {
      // socket.off("connect");
      // socket.off("offer");
      // socket.off("answer");
      socket.disconnect();
      // socket.off("candidate");
    };
  }, [solwallet]);
  const serializeSignAndSend = async (prevBlock?: Block) => {

    if (dataChannel.readyState === "open") {
      const data = JSON.stringify(game.serialize());
      blockNum = prevBlock ? prevBlock.num + 1 : 0;
      //console.log(blockNum);
      const block: Block = {
        data,
        num: blockNum,
        timestamp: Date.now(),
      };
      const blockhash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(block)));
      const sig = wallet.signMessageSync(blockhash);
      const blockData: BlockData = {
        type: "__data",
        block: JSON.stringify(block),
        sig1: playerNum === 1 ? sig : "",
        pub1: playerNum === 1 ? wallet.address : "",
        sig2: playerNum === 2 ? sig : "",
        pub2: playerNum === 2 ? wallet.address : ""
      };
      if (prevBlock) lastSignedBlock = block;
      dataChannel.send(JSON.stringify(blockData));
      //socket.emit("data", blockData);
    }
  };
  const verifySig = (data: BlockData): boolean => {
    if (playerNum === 1) {
      // verify player2's signature
      const hash = ethers.keccak256(ethers.toUtf8Bytes(data.block));
      const recoveredAddress = ethers.verifyMessage(hash, data.sig2);
      return recoveredAddress.toLowerCase() === data.pub2.toLowerCase();
    } else {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(data.block));
      const recoveredAddress = ethers.verifyMessage(hash, data.sig1);
      return recoveredAddress.toLowerCase() === data.pub1.toLowerCase();
      // verify player1's signature
    }
  };
  const onWin = async () => {
    if (message === "You Won!") return;
    setMessage("You Won!");
    await sendSOL(solwallet.publicKey!.toString(), 0.015);
  };
  const onLoss = () => {
    setMessage("You Lost...");
  };
  const resetGame = () => {
    window.location.reload();
  };
  const receiveMessage = async (event: MessageEvent | { data: any; }) => {
    //console.log(event.data);
    let data = JSON.parse(event.data); // when using ws, dont need to to JSON.parse(data);
    // try {
    //   //data = JSON.parse(event.data);
    // } catch (e) {
    //   console.error("eeeee");
    //   console.error(e);
    //   console.log(event.data);
    //   console.log(event.data.indexOf("[object Object]"));
    // }
    const { type } = data;
    // console.log(event.data);
    switch (type) {
      case "__handshake": {
        break;
      }
      case "__data": {
        const block: Block = JSON.parse(data.block);
        // console.log(block);
        const sigstatus = verifySig(data);
        const orderstatus = block.num === blockNum + 1; // assert this is next block
        const verifystatus = game.verify(block, onWin, onLoss, playerNum);
        new Promise((resolve) => setTimeout(resolve, 1000 / 240)).then(() => {
          gameFrame();
          serializeSignAndSend(block);
        });
        break;
      }
      default: {
        console.log(`Type: ${type}`);
        break;
      }
    }
  };
  const callPeer = async (peerId: string) => {
    if (!localPeer.current) return;
    // if (!solwallet.connected) {
    //   alert("Connect your wallet!")
    //   return;
    // }
    const offer = await localPeer.current.createOffer();
    await localPeer.current.setLocalDescription(offer);
    setCalling(true);
    // await recieveSOL(solwallet.publicKey!.toString(), 0.01, solwallet.signTransaction!);
    socket.emit('offer', { offer, to: peerId });
  };
  useEffect(() => {
    ran++;
    if (ran === 2) return;
    if (window.innerWidth < 768) {
      width = 600;
      height = 600;
    } else {
      width = 600;
      height = 600;
    }
    backgroundImage = document.createElement("img");
    backgroundImage.src = "/background.png";
    canvas = document.getElementById("gameField") as HTMLCanvasElement;
    ctx = canvas.getContext("2d")!;
    game = new Game();
    canvas.width = width;
    canvas.height = height;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    // return () => {
    //   document.removeEventListener("keydown", handleKeyDown);
    //   document.removeEventListener("keyup", handleKeyUp);
    //   document.removeEventListener("mousemove", handleMouseMove);
    //   document.removeEventListener("mousedown", handleMouseDown);
    //   document.removeEventListener("mouseup", handleMouseUp);
    //   console.log("removed");
    // };
  }, []);
  const handleKeyDown = (event: KeyboardEvent) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowLeft", "ArrowUp"];
    if (keys.includes(event.key)) {
      event.preventDefault();
      game.players[playerNum - 1].pressed = event.key;
    }
  };
  const handleKeyUp = (_: KeyboardEvent) => {
    game.players[playerNum - 1].pressed = "";
  };
  const handleMouseMove = (event: MouseEvent) => {
    mousePos = [event.clientX, event.clientY];
  };
  const handleMouseDown = (_: MouseEvent) => {
    game.players[playerNum - 1].shooting = true;
  };
  const handleMouseUp = (_: MouseEvent) => {
    game.players[playerNum - 1].shooting = false;
  };
  const clearCanvas = () => {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  };
  const gameFrame = () => {
    clearCanvas();
    const rect = canvas.getBoundingClientRect();
    game.update(mousePos[0], mousePos[1], playerNum - 1, rect.x, rect.y);
    game.draw(ctx);
    //requestAnimationFrame(gameFrame);
  };
  const findOpponents = () => {
    socket.emit("otherPlayer");
  };
  const pay = async () => {
    await recieveSOL(solwallet.publicKey!.toString(), 0.01, solwallet.signTransaction!);
    setPaid(true);
  }
  return (
          <div className="parent">
            <p><u>Tank Battle</u></p>
            <div>Your ID: {localPeerId}</div>
            <p>Note: You will not be able to play on some wifi networks if the security settings block p2p connections {`:(`}</p>
            <p>Check out the youtube video for an example: {`Insert video here`}</p>
            <p>In reality, an app like this should be ran outside a browser environment to allow for the best routes to be found</p>
            <p>Just have your friend load up the page, click the Find Opponent button, compare their id to the id of the player you want to play, and then press the call button twice - once to open the call, once to open the data channel</p>
            <button onClick={() => window.location.href = "/whitepaper.pdf"}>Whitepaper</button>
            <div className="row">
              <WalletMultiButtonDynamic />
              <WalletDisconnectButtonDynamic />
            </div>
            {paid ? 
                <button onClick={findOpponents} style={{ marginTop: "10px" }}>Find Opponent</button>
              :
                <button onClick={pay}>Pay</button>
            }
            <div className="col" style={{ gap: "10px" }}>
              {peerIds.map((peerId: string, i: number) => {
                return (
                  <div key={i} className="row" style={{ gap: "10px" }}>
                    <p>{peerId}</p>
                    <button onClick={() => callPeer(peerId)}>{calling ? "Connect" : "Call Peer"}</button>
                  </div>
                );
              })

              }
            </div>
            {/* <div className="row" style={{gap: "10px"}}> */}
            {/* <input
          type="text"
          placeholder="Remote Peer ID"
          value={remotePeerId}
          onChange={(e) => setRemotePeerId(e.target.value)}
        /> */}
            {/* <button onClick={callPeer}>Call Peer</button> */}            {/* </div> */}
            <div>
              <div className="col">
                <div style={{ width: width, height: height, position: "relative" }}>
                  <canvas id="gameField" style={{ border: "1px solid black" }}></canvas>
                  {message &&
                    <div style={{ position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }} className="col">
                      <p>{message}</p>
                      <button onClick={resetGame}>Reset</button>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
  );
}