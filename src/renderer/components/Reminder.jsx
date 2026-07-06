import React from 'react'

export default function Reminder() {
  return (
    <div className="reminder">
      <div className="reminder-card">
        <div className="reminder-eye">👁</div>
        <h1 className="reminder-title">該讓眼睛休息一下了</h1>
        <p className="reminder-sub">你已經專注 20 分鐘囉</p>

        <p className="reminder-body">
          按下「好,我知道了」後,請到右下角小工具點
          <span className="reminder-btn-name">▶ 開始計時休息</span>,
          望向約 <b>6 公尺(20 呎)</b> 外的地方,放鬆 20 秒。
        </p>

        <button
          className="reminder-ok"
          autoFocus
          onClick={() => window.electronAPI?.acknowledgeBreak()}
        >
          好,我知道了
        </button>
      </div>
    </div>
  )
}
