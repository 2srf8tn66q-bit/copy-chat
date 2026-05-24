import { useLocation } from 'react-router-dom';
import ParticleCanvas from './ParticleCanvas';
import GrainOverlay from './GrainOverlay';

/**
 * 全局氛围层 — 在所有非聊天页面渲染粒子 + 噪点。
 * 聊天/群聊页用浅色背景模拟微信，跳过氛围层避免冲突。
 */
const EXCLUDE_PATTERNS = [
  /^\/characters\/[^/]+\/chat$/,
  /^\/characters\/[^/]+\/whatif$/,
  /^\/groups\/[^/]+$/,
];

export default function Atmosphere() {
  const location = useLocation();
  const skip = EXCLUDE_PATTERNS.some((re) => re.test(location.pathname));
  if (skip) return null;

  return (
    <>
      <ParticleCanvas density={0.4} intensity={0.7} />
      <GrainOverlay />
    </>
  );
}
