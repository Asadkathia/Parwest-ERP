"use client"

import { useFormStatus } from "react-dom"
import { authenticate } from "./actions"
import { useActionState, useEffect, useState } from "react"
import Image from "next/image"

/* equirectangular: lon/lat → svg x/y in 1000×500 canvas */
const toX = (lon: number) => ((lon + 180) / 360) * 1000
const toY = (lat: number) => ((90 - lat) / 180) * 500

const CITIES = [
    { id: "pak", label: "Pakistan",  x: toX(71),  y: toY(30),  hub: true,  primary: true  },
    { id: "dxb", label: "Dubai",     x: toX(55.3),y: toY(25.2),hub: false, primary: true  },
    { id: "lon", label: "London",    x: toX(-0.1),y: toY(51.5),hub: false, primary: true  },
    { id: "sin", label: "Singapore", x: toX(103.8),y: toY(1.4),hub: false, primary: false },
    { id: "nyc", label: "New York",  x: toX(-74), y: toY(40.7),hub: false, primary: false },
    { id: "ist", label: "Istanbul",  x: toX(29),  y: toY(41),  hub: false, primary: false },
    { id: "tyo", label: "Tokyo",     x: toX(139.7),y: toY(35.7),hub: false, primary: false },
]

const ARCS: [string, string][] = [
    ["pak","lon"], ["pak","nyc"], ["pak","dxb"],
    ["pak","sin"], ["pak","ist"], ["pak","tyo"],
]

function getCity(id: string) { return CITIES.find(c => c.id === id)! }

/* arc control point — bows toward poles for a globe feel */
function arcQ(ax: number, ay: number, bx: number, by: number) {
    const mx = (ax + bx) / 2
    const bow = Math.abs(ax - bx) * 0.18 + 30
    const my = Math.min(ay, by) - bow
    return `M${ax},${ay} Q${mx},${my} ${bx},${by}`
}

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button type="submit" disabled={pending} className="lp-btn">
            {pending ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <span className="lp-spinner" /> Authenticating…
                </span>
            ) : "Sign In"}
        </button>
    )
}

export default function LoginPage() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined)
    const [showPwd, setShowPwd] = useState(false)

    useEffect(() => {
        if (errorMessage === "success") { window.location.href = "/dashboard" }
    }, [errorMessage])

    return (
        <>
            <style>{`
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

                .lp-root{min-height:100vh;display:flex;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;overflow:hidden}

                /* ── LEFT PANEL ── */
                .lp-map{flex:0 0 58%;position:relative;background:#07102b;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end}

                /* vignette edges */
                .lp-map::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 80% at 50% 50%,transparent 40%,rgba(7,16,43,0.65) 100%);pointer-events:none;z-index:2}

                .lp-svg{position:absolute;inset:0;width:100%;height:100%;z-index:1}

                /* arc draw-on */
                @keyframes lp-arc{from{stroke-dashoffset:2000}to{stroke-dashoffset:0}}
                .lp-arc{stroke-dasharray:2000;stroke-dashoffset:2000;animation:lp-arc 2.2s ease forwards}

                /* city pulse rings */
                @keyframes lp-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(4.5);opacity:0}}
                .lp-ring{transform-box:fill-box;transform-origin:center;animation:lp-ring 2.8s ease-out infinite}

                /* glow blob breathe */
                @keyframes lp-breathe{0%,100%{opacity:.55}50%{opacity:.75}}
                .lp-breathe{animation:lp-breathe 4s ease-in-out infinite}

                /* brand bar */
                .lp-brand{position:relative;z-index:10;padding:34px 44px;width:100%}
                .lp-brand-logo{display:flex;align-items:center;gap:14px;margin-bottom:12px}
                .lp-brand-tag{font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:rgba(255,255,255,.35);font-weight:500;margin-bottom:5px}
                .lp-brand-head{font-size:26px;font-weight:700;color:#fff;line-height:1.25;letter-spacing:-.4px;max-width:340px}
                .lp-brand-head span{color:#5b8fff}
                .lp-stats{display:flex;gap:28px;margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07)}
                .lp-stat-val{font-size:21px;font-weight:700;color:#fff;line-height:1}
                .lp-stat-lbl{font-size:10px;color:rgba(255,255,255,.32);margin-top:3px;letter-spacing:.5px}

                /* ── RIGHT PANEL ── */
                .lp-form-panel{flex:1;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 52px;position:relative;border-left:1px solid #e2e8f0}
                .lp-form-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#2f5bff 0%,#7ba3ff 50%,#2f5bff 100%);background-size:200% auto;animation:lp-shift 4s linear infinite}
                @keyframes lp-shift{0%{background-position:0% center}100%{background-position:200% center}}

                .lp-form-inner{width:100%;max-width:340px}
                .lp-logo-row{display:flex;align-items:center;gap:10px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e2e8f0}
                .lp-logo-box{width:36px;height:36px;border-radius:10px;background:#0b1224;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
                .lp-logo-name{font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-.2px;line-height:1.1}
                .lp-logo-sub{font-size:11px;color:#64748b;letter-spacing:.3px}
                .lp-title{font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-.4px;margin-bottom:4px}
                .lp-sub{font-size:13px;color:#64748b;margin-bottom:28px}
                .lp-field{margin-bottom:18px}
                .lp-label{display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:6px}
                .lp-input{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-size:14px;color:#0f172a;background:#f8fafc;outline:none;transition:border-color .2s,box-shadow .2s,background .2s}
                .lp-input::placeholder{color:#94a3b8}
                .lp-input:focus{border-color:#2f5bff;background:#fff;box-shadow:0 0 0 3px rgba(47,91,255,.12)}
                .lp-wrap{position:relative}
                .lp-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;padding:4px;transition:color .15s}
                .lp-eye:hover{color:#2f5bff}
                .lp-extras{display:flex;align-items:center;margin-bottom:24px}
                .lp-remember{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;color:#64748b}
                .lp-remember input{accent-color:#2f5bff;cursor:pointer}
                .lp-error{display:flex;align-items:center;gap:8px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:13px;padding:10px 13px;border-radius:10px;margin-bottom:16px}
                .lp-error::before{content:"⚠";flex-shrink:0}
                @keyframes lp-shine{0%{transform:translateX(-100%) skewX(-15deg)}100%{transform:translateX(300%) skewX(-15deg)}}
                .lp-btn{width:100%;padding:12px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;border:none;cursor:pointer;background:#2f5bff;position:relative;overflow:hidden;transition:background .2s,transform .1s,box-shadow .2s;box-shadow:0 4px 14px rgba(47,91,255,.35)}
                .lp-btn::after{content:'';position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);animation:lp-shine 3s ease-in-out infinite}
                .lp-btn:hover:not(:disabled){background:#2649d4;box-shadow:0 6px 20px rgba(47,91,255,.45);transform:translateY(-1px)}
                .lp-btn:active:not(:disabled){transform:translateY(0)}
                .lp-btn:disabled{opacity:.55;cursor:not-allowed}
                @keyframes lp-spin{to{transform:rotate(360deg)}}
                .lp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:lp-spin .65s linear infinite;flex-shrink:0}
                .lp-footer{text-align:center;margin-top:28px;font-size:12px;color:#94a3b8}

                @media(max-width:820px){.lp-map{display:none}.lp-form-panel{padding:40px 24px;border-left:none}}
            `}</style>

            <div className="lp-root">

                {/* ══════════════════ LEFT MAP PANEL ══════════════════ */}
                <div className="lp-map">
                    <svg
                        className="lp-svg"
                        viewBox="0 0 1000 500"
                        preserveAspectRatio="xMidYMid slice"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            {/* Pakistan glow */}
                            <radialGradient id="gPak" cx="70%" cy="34%" r="22%">
                                <stop offset="0%"   stopColor="#3d6aff" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="#3d6aff" stopOpacity="0" />
                            </radialGradient>
                            {/* subtle blue sea tint */}
                            <radialGradient id="gSea" cx="60%" cy="40%" r="65%">
                                <stop offset="0%"   stopColor="#0d1e45" stopOpacity="1" />
                                <stop offset="100%" stopColor="#07102b" stopOpacity="1" />
                            </radialGradient>
                            {/* dot glow */}
                            <filter id="fGlow" x="-80%" y="-80%" width="260%" height="260%">
                                <feGaussianBlur stdDeviation="3" result="b"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            {/* arc glow */}
                            <filter id="fArc" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1.5" result="b"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                        </defs>

                        {/* Ocean base */}
                        <rect width="1000" height="500" fill="url(#gSea)" />

                        {/* Lat/lon grid */}
                        {[20,40,60,80].map(lat => (
                            <line key={`lat${lat}`}
                                x1="0" y1={toY(lat)} x2="1000" y2={toY(lat)}
                                stroke="rgba(100,150,255,0.07)" strokeWidth="0.5"
                            />
                        ))}
                        {[20,40,60,80].map(lat => (
                            <line key={`latn${lat}`}
                                x1="0" y1={toY(-lat)} x2="1000" y2={toY(-lat)}
                                stroke="rgba(100,150,255,0.07)" strokeWidth="0.5"
                            />
                        ))}
                        {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lon => (
                            <line key={`lon${lon}`}
                                x1={toX(lon)} y1="0" x2={toX(lon)} y2="500"
                                stroke="rgba(100,150,255,0.07)" strokeWidth="0.5"
                            />
                        ))}
                        {/* Equator */}
                        <line x1="0" y1="250" x2="1000" y2="250"
                            stroke="rgba(100,150,255,0.12)" strokeWidth="0.7" strokeDasharray="5,5" />
                        {/* Tropic of Cancer */}
                        <line x1="0" y1={toY(23.5)} x2="1000" y2={toY(23.5)}
                            stroke="rgba(100,150,255,0.07)" strokeWidth="0.5" strokeDasharray="3,6" />

                        {/* ──── CONTINENT SHAPES ──── */}
                        {/* Greenland */}
                        <path
                            d="M295,28 L355,22 L412,32 L418,60 L392,84 L348,90 L294,73 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.32)" strokeWidth="0.8"
                        />
                        {/* North America */}
                        <path
                            d="M42,65 L28,90 L33,128 L55,165 L84,192 L120,215 L155,222 L198,245 L230,242 L262,222 L280,184 L294,162 L322,144 L350,114 L332,96 L296,80 L252,68 L200,58 L155,55 L112,57 L72,58 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.32)" strokeWidth="0.8"
                        />
                        {/* South America */}
                        <path
                            d="M278,234 L320,220 L370,228 L404,268 L418,308 L404,362 L372,402 L342,424 L318,406 L295,365 L278,318 L274,278 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.32)" strokeWidth="0.8"
                        />
                        {/* Europe */}
                        <path
                            d="M476,148 L468,124 L474,102 L492,88 L512,80 L532,68 L558,62 L580,74 L585,95 L570,110 L580,128 L566,150 L546,154 L524,152 L504,157 L488,154 Z"
                            fill="rgba(45,80,175,0.3)" stroke="rgba(90,140,255,0.35)" strokeWidth="0.8"
                        />
                        {/* Africa */}
                        <path
                            d="M484,150 L530,147 L600,164 L640,220 L624,264 L592,298 L568,342 L551,348 L525,350 L498,342 L476,316 L458,286 L452,247 L456,215 L470,196 L480,174 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.32)" strokeWidth="0.8"
                        />
                        {/* Arabia */}
                        <path
                            d="M558,175 L598,168 L638,172 L648,192 L638,222 L618,235 L596,228 L572,210 L556,196 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.28)" strokeWidth="0.7"
                        />
                        {/* Asia main */}
                        <path
                            d="M574,142 L598,128 L636,114 L685,104 L742,100 L805,108 L848,116 L885,132 L890,154 L874,172 L840,185 L798,195 L752,204 L712,215 L680,228 L653,238 L625,248 L608,258 L614,234 L597,214 L575,198 L560,178 L564,160 Z"
                            fill="rgba(45,80,175,0.26)" stroke="rgba(90,140,255,0.3)" strokeWidth="0.8"
                        />
                        {/* Indian Subcontinent */}
                        <path
                            d="M665,194 L682,178 L703,172 L724,180 L728,204 L720,230 L702,255 L680,257 L661,238 L653,215 Z"
                            fill="rgba(45,80,175,0.3)" stroke="rgba(90,140,255,0.28)" strokeWidth="0.7"
                        />
                        {/* Pakistan highlight — brighter */}
                        <path
                            d="M650,152 L676,145 L706,148 L720,162 L718,186 L700,196 L672,196 L650,182 L643,166 Z"
                            fill="rgba(55,100,255,0.42)" stroke="rgba(120,165,255,0.7)" strokeWidth="1.2"
                        />
                        {/* SE Asia */}
                        <path
                            d="M758,198 L794,188 L822,202 L838,222 L830,244 L808,250 L780,243 L762,228 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.28)" strokeWidth="0.7"
                        />
                        {/* Australia */}
                        <path
                            d="M820,314 L848,292 L880,285 L922,300 L930,332 L910,362 L880,372 L840,363 L820,344 Z"
                            fill="rgba(45,80,175,0.28)" stroke="rgba(90,140,255,0.32)" strokeWidth="0.8"
                        />
                        {/* Japan */}
                        <path
                            d="M935,126 L948,118 L958,125 L954,138 L942,142 L932,135 Z"
                            fill="rgba(45,80,175,0.32)" stroke="rgba(90,140,255,0.3)" strokeWidth="0.6"
                        />

                        {/* ──── Pakistan radial glow ──── */}
                        <circle cx={toX(71)} cy={toY(30)} r="150"
                            fill="url(#gPak)" className="lp-breathe" />

                        {/* ──── Arcs from Pakistan to each city ──── */}
                        {ARCS.map(([a, b], i) => {
                            const ca = getCity(a), cb = getCity(b)
                            return (
                                <path key={i}
                                    d={arcQ(ca.x, ca.y, cb.x, cb.y)}
                                    fill="none"
                                    stroke={i < 3 ? "rgba(91,143,255,0.55)" : "rgba(91,143,255,0.32)"}
                                    strokeWidth={i < 3 ? 1 : 0.7}
                                    strokeLinecap="round"
                                    filter="url(#fArc)"
                                    className="lp-arc"
                                    style={{ animationDelay: `${i * 0.28}s` }}
                                />
                            )
                        })}

                        {/* ──── City markers ──── */}
                        {CITIES.map((city, i) => (
                            <g key={city.id} filter="url(#fGlow)">
                                {/* Hub pulse rings */}
                                {city.hub && [0, 1.4].map((d, ri) => (
                                    <circle key={ri}
                                        cx={city.x} cy={city.y}
                                        r={city.hub ? 5 : 3}
                                        fill="none"
                                        stroke="rgba(91,143,255,0.5)"
                                        strokeWidth="0.8"
                                        className="lp-ring"
                                        style={{ animationDelay: `${d}s` }}
                                    />
                                ))}
                                {/* Primary city single ring */}
                                {!city.hub && city.primary && (
                                    <circle
                                        cx={city.x} cy={city.y} r="3"
                                        fill="none"
                                        stroke="rgba(91,143,255,0.4)"
                                        strokeWidth="0.6"
                                        className="lp-ring"
                                        style={{ animationDelay: `${i * 0.55}s` }}
                                    />
                                )}
                                {/* Outer halo */}
                                <circle cx={city.x} cy={city.y}
                                    r={city.hub ? 5 : city.primary ? 3 : 2}
                                    fill={city.hub ? "rgba(91,143,255,0.25)" : "rgba(91,143,255,0.15)"}
                                />
                                {/* Core */}
                                <circle cx={city.x} cy={city.y}
                                    r={city.hub ? 3.5 : city.primary ? 2.2 : 1.5}
                                    fill={city.hub ? "#5b8fff" : city.primary ? "#4472ff" : "#3058cc"}
                                />
                                {/* Bright center */}
                                <circle cx={city.x} cy={city.y}
                                    r={city.hub ? 1.2 : 0.7}
                                    fill="#fff"
                                />
                                {/* Label */}
                                <text
                                    x={city.x + (city.hub ? 7 : 5)}
                                    y={city.y - (city.hub ? 5 : 3)}
                                    fill={city.hub
                                        ? "rgba(255,255,255,0.95)"
                                        : city.primary
                                            ? "rgba(200,220,255,0.75)"
                                            : "rgba(170,200,255,0.55)"}
                                    fontSize={city.hub ? "9.5" : city.primary ? "7.5" : "6.5"}
                                    fontFamily="-apple-system,sans-serif"
                                    fontWeight={city.hub ? "700" : "400"}
                                    letterSpacing="1.5"
                                    style={{ textTransform: "uppercase" }}
                                >
                                    {city.label}
                                </text>
                                {city.hub && (
                                    <text
                                        x={city.x + 7}
                                        y={city.y + 5}
                                        fill="rgba(91,143,255,0.75)"
                                        fontSize="6.5"
                                        fontFamily="-apple-system,sans-serif"
                                        letterSpacing="1"
                                        style={{ textTransform: "uppercase" }}
                                    >
                                        Headquarters
                                    </text>
                                )}
                            </g>
                        ))}
                    </svg>

                    {/* ── Brand bar ── */}
                    <div className="lp-brand">
                        <div className="lp-brand-logo">
                            <Image
                                src="/parwest-logo.png"
                                alt="Parwest"
                                width={130}
                                height={36}
                                style={{ filter:"brightness(0) invert(1)", objectFit:"contain" }}
                                priority
                            />
                        </div>
                        <p className="lp-brand-tag">Guard Management System</p>
                        <h2 className="lp-brand-head">
                            Nationwide Security<br />
                            <span>Operations Platform</span>
                        </h2>
                        <div className="lp-stats">
                            <div><div className="lp-stat-val">7</div><div className="lp-stat-lbl">Regions</div></div>
                            <div><div className="lp-stat-val">24/7</div><div className="lp-stat-lbl">Monitoring</div></div>
                            <div><div className="lp-stat-val">100%</div><div className="lp-stat-lbl">Compliance</div></div>
                        </div>
                    </div>
                </div>

                {/* ══════════════════ RIGHT FORM PANEL ══════════════════ */}
                <div className="lp-form-panel">
                    <div className="lp-form-inner">

                        {/* Logo */}
                        <div className="lp-logo-row">
                            <div className="lp-logo-box">
                                <Image src="/favicon-32.png" alt="" width={28} height={28} style={{ objectFit:"contain" }} />
                            </div>
                            <div>
                                <div className="lp-logo-name">Parwest ERP</div>
                                <div className="lp-logo-sub">Guard Management System</div>
                            </div>
                        </div>

                        <h1 className="lp-title">Welcome back</h1>
                        <p className="lp-sub">Sign in to your account to continue</p>

                        <form action={dispatch}>
                            <div className="lp-field">
                                <label htmlFor="email" className="lp-label">Email Address</label>
                                <input id="email" name="email" type="email" required autoComplete="email"
                                    className="lp-input" placeholder="admin@parwestgroup.com" />
                            </div>
                            <div className="lp-field">
                                <label htmlFor="password" className="lp-label">Password</label>
                                <div className="lp-wrap">
                                    <input id="password" name="password" type={showPwd ? "text" : "password"}
                                        required autoComplete="current-password"
                                        className="lp-input" placeholder="••••••••"
                                        style={{ paddingRight:52 }} />
                                    <button type="button" className="lp-eye"
                                        onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
                                        {showPwd ? "HIDE" : "SHOW"}
                                    </button>
                                </div>
                            </div>
                            <div className="lp-extras">
                                <label className="lp-remember">
                                    <input type="checkbox" /> Remember me
                                </label>
                            </div>
                            {errorMessage && errorMessage !== "success" && (
                                <div className="lp-error">{errorMessage}</div>
                            )}
                            <SubmitButton />
                        </form>

                        <p className="lp-footer">Contact your administrator for access</p>
                    </div>
                </div>

            </div>
        </>
    )
}