// Hong Kong Observatory weather-photo stations.
// Codes are the photo filenames listed at https://www.hko.gov.hk/en/wxinfo/ts/index_webcam.htm.
// `approx: true` marks a landmark position rather than a surveyed camera position.
export interface HkoStation {
  code: string;
  nameZh: string;
  name: string;
  lat: number;
  lon: number;
  approx: boolean;
}

const rows: [string, string, string, number, number, boolean][] = [
  ["LFS", "流浮山", "Lau Fau Shan", 22.46889, 113.98361, false],
  ["WLP", "濕地公園", "Wetland Park", 22.46667, 114.00889, false],
  ["ELC", "上水風采中學", "Elegantia College, Sheung Shui", 22.5025, 114.1265, true],
  ["KFB", "嘉道理農場", "Kadoorie Farm", 22.43278, 114.12083, false],
  ["TPK", "大埔滘", "Tai Po Kau", 22.4425, 114.18389, false],
  ["TM2", "大帽山（西南）", "Tai Mo Shan (SW)", 22.4105, 114.1244, true],
  ["TM3", "大帽山（東北）", "Tai Mo Shan (NE)", 22.4105, 114.1244, true],
  ["TLC", "大欖涌", "Tai Lam Chung", 22.3667, 114.0167, true],
  ["SK2", "西貢水警東（東北）", "Sai Kung Marine East (NE)", 22.3802, 114.283, true],
  ["SKG", "西貢水警東（東南）", "Sai Kung Marine East (SE)", 22.37556, 114.27444, false],
  ["CWB", "清水灣（東）", "Clear Water Bay (E)", 22.26333, 114.29972, false],
  ["CWA", "清水灣（西南）", "Clear Water Bay (SW)", 22.27, 114.291, true],
  ["KS2", "滘西洲", "Kau Sai Chau", 22.355, 114.316, true],
  ["KLT", "九龍城", "Kowloon City", 22.335, 114.18472, false],
  ["HK2", "尖沙咀、環球貿易廣場", "Tsim Sha Tsui & ICC", 22.3027, 114.1742, true],
  ["HKO", "尖沙咀", "Tsim Sha Tsui", 22.30194, 114.17417, false],
  ["HMM", "香港海事博物館", "Maritime Museum", 22.2855, 114.1615, true],
  ["VPB", "太平山（北）", "Victoria Peak (N)", 22.2711, 114.149, true],
  ["VPA", "太平山（東）", "Victoria Peak (E)", 22.2711, 114.149, true],
  ["GSI", "德瑞國際學校", "German Swiss Int'l School", 22.2667, 114.1444, true],
  ["SWH", "西灣河", "Sai Wan Ho", 22.283, 114.222, true],
  ["SLW", "沙螺灣", "Sha Lo Wan", 22.29111, 113.90694, false],
  ["PE2", "坪洲（遠眺竹篙灣）", "Peng Chau (Penny's Bay)", 22.2833, 114.0333, true],
  ["DNL", "坪洲（遠眺維港）", "Peng Chau (Victoria Harbour)", 22.286, 114.038, true],
  ["CCH", "長洲（北）", "Cheung Chau (N)", 22.20111, 114.02667, false],
  ["CCE", "長洲東灣", "Cheung Chau Tung Wan", 22.208, 114.028, true],
  ["LAM", "南丫島", "Lamma Island", 22.22611, 114.10861, false],
  ["WL2", "橫瀾島（西北）", "Waglan Island (NNW)", 22.18222, 114.30333, false],
  ["WGL", "橫瀾島（北）", "Waglan Island (N)", 22.18222, 114.30333, false],
  ["CS1", "長沙（西北）", "Cheung Sha (NW)", 22.228, 113.937, true],
  ["CS2", "長沙（北）", "Cheung Sha (N)", 22.228, 113.937, true],
  ["CP1", "中環碼頭", "Central Pier", 22.28889, 114.15583, false],
  ["IC1", "環球貿易廣場（東南）", "ICC (SE)", 22.3033, 114.1603, true],
  ["IC2", "環球貿易廣場（西南）", "ICC (SW)", 22.3033, 114.1603, true],
];

export const HKO_STATIONS: HkoStation[] = rows.map(([code, nameZh, name, lat, lon, approx]) => ({
  code,
  nameZh,
  name,
  lat,
  lon,
  approx,
}));
