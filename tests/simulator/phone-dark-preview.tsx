import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PhoneIcon, type PhoneIconName } from "../../src/phone-icons";
import "../../src/phone/phone-shell.css";
import "../../src/phone/phone-home.css";
import "./phone-dark-preview.css";
const asset = "/output/phone-dark-design-2026-11-09/";
function Products() {return <div className="products"><div className="product-g2"><img src={asset+"g2.png"} alt="Even G2"/></div><div className="product-r1"><img src={asset+"r1.png"} alt="Even R1"/></div></div>;}
const cards: {title:string;icon:PhoneIconName;status:string}[] = [
  {title:"HUD 구성",icon:"layout",status:"7개 페이지 사용 중"},{title:"AI에게 묻기",icon:"ai",status:"길게 눌러 질문하기"},
  {title:"Conversate",icon:"ai",status:"자막 · 번역 · Inform · Copilot"},{title:"뉴스",icon:"article",status:"최신 소식"},
  {title:"내비게이션",icon:"navigation",status:"목적지 설정"},
];
function Preview() {
 const [mode,setMode]=useState("dark"),[charging,setCharging]=useState(true);
 return <><header className="review-head"><h1>SANDEVISTAN</h1><p>휴대폰 화면 시안 · 배터리는 예시 값입니다</p><div className="mode">{["system","light","dark"].map((m,i)=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{["자동","라이트","다크"][i]}</button>)}</div></header>
 <main className="review" data-theme={mode==="light"?"light":"dark"}>
 <section className="phone-companion"><div className="phone-home">
 <div className="preview-theme-row"><span>화면 테마</span><span>{mode==="system"?"시스템 설정 따름":mode==="dark"?"다크 테마":"라이트 테마"}</span></div>
 <section className="hud-preview"><img src="/output/ask-ai-hold-exit-2026-11-08/exit-dashboard-canvas.png" alt="SANDEVISTAN HUD 미리보기"/></section>
 <h2 className="phone-home__section-title">대시보드</h2><nav className="phone-home__grid">
 <button className="phone-home-card devices-card"><Products/><div className="battery-pair"><span>G2 <b>88%</b></span><span>R1 <b>64%</b></span></div><span className="device-summary">안경 · 반지</span></button>
 {cards.map(c=><button key={c.title} className="phone-home-card"><PhoneIcon name={c.icon} size={30}/><span className="phone-home-card__copy"><strong>{c.title}</strong><small>{c.status}</small></span></button>)}
 </nav><footer className="preview-footer">SANDEVISTAN · 개발 버전</footer></div></section>
 <section className="phone-companion"><div className="phone-detail-screen"><header className="phone-detail-header"><span>대시보드 / 기기</span></header><button className="phone-detail-back"><span>대시보드로 돌아가기</span></button><div className="phone-detail-content phone-detail-stack">
 <section className="phone-panel device-detail"><div className="device-title"><h2>Even G2</h2><span>연결됨</span></div><div className="detail-product g2"><img src={asset+"g2.png"} alt="Even G2"/></div><div className="device-battery"><strong>88<span>%</span></strong><span>안경 배터리</span></div><div className="battery-track"><span style={{width:"88%"}}/></div></section>
 <section className="phone-panel device-detail"><div className="device-title"><h2>Even R1</h2><span>연결됨</span></div><div className="detail-product r1"><img src={asset+"r1.png"} alt="Even R1"/></div><div className="device-battery"><strong>64<span>%</span></strong><button className="charge-toggle" onClick={()=>setCharging(!charging)}>{charging?"충전 중":"반지 배터리"}</button></div><div className="battery-track"><span style={{width:"64%"}}/></div></section>
 <section className="phone-panel unavailable"><span>값을 받지 못한 경우</span><strong>—% · 정보 없음</strong><small>기기별로 받은 배터리와 충전 상태를 표시합니다.</small></section>
 </div></div></section></main></>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
