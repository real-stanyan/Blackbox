import { useState } from 'react';
import { Screen } from '../components/Screen';
import { Group } from '../components/Group';
import { Row } from '../components/Row';
import { Toggle } from '../components/Toggle';
import { useTheme } from '../context/Theme';
import { useVehicle } from '../hooks/useVehicle';

// Settings — 设置。对照 prototype/screensB.jsx SettingsScreen。
export function SettingsScreen() {
  const t = useTheme();
  const D = useVehicle();
  const [autoConn, setAuto] = useState(true);
  const [chime, setChime] = useState(true);
  const [nConn, setNConn] = useState(true);
  const [nDis, setNDis] = useState(true);
  const [nRep, setNRep] = useState(true);

  return (
    <Screen title="设置">
      <Group header="设备">
        <Row icon="bluetooth" iconBg={t.blue} title={D.adapter} sub="已配对 · 蓝牙" value="已连接" valueColor={t.green} accessory="chevron" onClick={() => {}} />
        <Row icon="car" iconBg={t.orange} title="自动连接" sub="上车后自动连接并记录" right={<Toggle on={autoConn} onChange={setAuto} />} last />
      </Group>
      <Group header="通知与提示音" footer="连接与断开时推送通知并响铃,无需一直查看 App。">
        <Row icon="sound" iconBg={t.orange} title="连接提示音" right={<Toggle on={chime} onChange={setChime} />} />
        <Row icon="bell" iconBg={t.green} title="连接成功推送" right={<Toggle on={nConn} onChange={setNConn} />} />
        <Row icon="bell" iconBg={t.amber} title="连接中断推送" right={<Toggle on={nDis} onChange={setNDis} />} />
        <Row icon="bell" iconBg={t.blue} title="行程报告就绪推送" right={<Toggle on={nRep} onChange={setNRep} />} last />
      </Group>
      <Group header="车辆">
        <Row title="车型" value={`${D.name} · ${D.model.split(' · ')[1]}`} accessory={null} />
        <Row title="发动机" value={D.engine} accessory={null} />
        <Row title="车牌" value={D.plate} accessory={null} />
        <Row title="总里程" value={`${D.odo.toLocaleString()} km`} accessory={null} last />
      </Group>
      <Group header="AI 分析">
        <Row title="MiniMax API Key" value="已设置 ••••" accessory="chevron" onClick={() => {}} />
        <Row title="报告语言" value="简体中文" accessory="chevron" onClick={() => {}} last />
      </Group>
      <Group header="数据">
        <Row title="导出全部行程数据" valueColor={t.blue} accessory="chevron" onClick={() => {}} />
        <Row title="清除本地数据" valueColor={t.red} accessory={null} onClick={() => {}} last />
      </Group>
      <Group footer="OBD 健康记录 · 个人工具,数据仅存本机。">
        <Row title="版本" value="1.0.0 (V1)" accessory={null} last />
      </Group>
    </Screen>
  );
}
