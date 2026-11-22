// Where HKO's named readings are: automatic weather stations (temperature) and districts (rainfall). Approximate
// positions, matched by the English or Chinese name HKO uses, so the viewer's device can pick the nearest one.
export interface Place {
  en: string;
  zh: string;
  lat: number;
  lon: number;
}

export const STATIONS: Place[] = [
  { en: "King's Park", zh: "京士柏", lat: 22.312, lon: 114.173 },
  { en: "Hong Kong Observatory", zh: "香港天文台", lat: 22.302, lon: 114.174 },
  { en: "Wong Chuk Hang", zh: "黃竹坑", lat: 22.248, lon: 114.174 },
  { en: "Ta Kwu Ling", zh: "打鼓嶺", lat: 22.528, lon: 114.157 },
  { en: "Lau Fau Shan", zh: "流浮山", lat: 22.469, lon: 113.984 },
  { en: "Tai Po", zh: "大埔", lat: 22.446, lon: 114.179 },
  { en: "Sha Tin", zh: "沙田", lat: 22.402, lon: 114.21 },
  { en: "Tuen Mun", zh: "屯門", lat: 22.386, lon: 113.964 },
  { en: "Tseung Kwan O", zh: "將軍澳", lat: 22.316, lon: 114.256 },
  { en: "Sai Kung", zh: "西貢", lat: 22.376, lon: 114.275 },
  { en: "Cheung Chau", zh: "長洲", lat: 22.201, lon: 114.027 },
  { en: "Chek Lap Kok", zh: "赤鱲角", lat: 22.31, lon: 113.922 },
  { en: "Tsing Yi", zh: "青衣", lat: 22.344, lon: 114.11 },
  { en: "Shek Kong", zh: "石崗", lat: 22.436, lon: 114.085 },
  { en: "Tsuen Wan Ho Koon", zh: "荃灣可觀", lat: 22.383, lon: 114.108 },
  { en: "Tsuen Wan Shing Mun Valley", zh: "荃灣城門谷", lat: 22.375, lon: 114.127 },
  { en: "Hong Kong Park", zh: "香港公園", lat: 22.278, lon: 114.162 },
  { en: "Shau Kei Wan", zh: "筲箕灣", lat: 22.282, lon: 114.236 },
  { en: "Kowloon City", zh: "九龍城", lat: 22.335, lon: 114.185 },
  { en: "Happy Valley", zh: "跑馬地", lat: 22.27, lon: 114.184 },
  { en: "Wong Tai Sin", zh: "黃大仙", lat: 22.339, lon: 114.206 },
  { en: "Stanley", zh: "赤柱", lat: 22.214, lon: 114.219 },
  { en: "Kwun Tong", zh: "觀塘", lat: 22.319, lon: 114.225 },
  { en: "Sham Shui Po", zh: "深水埗", lat: 22.336, lon: 114.137 },
  { en: "Kai Tak Runway Park", zh: "啟德跑道公園", lat: 22.305, lon: 114.216 },
  { en: "Yuen Long Park", zh: "元朗公園", lat: 22.441, lon: 114.018 },
  { en: "Tai Mei Tuk", zh: "大美督", lat: 22.475, lon: 114.237 },
];

export const DISTRICTS: Place[] = [
  { en: "Central & Western District", zh: "中西區", lat: 22.282, lon: 114.15 },
  { en: "Eastern District", zh: "東區", lat: 22.279, lon: 114.226 },
  { en: "Kwai Tsing", zh: "葵青", lat: 22.354, lon: 114.118 },
  { en: "Islands District", zh: "離島區", lat: 22.262, lon: 113.946 },
  { en: "North District", zh: "北區", lat: 22.496, lon: 114.138 },
  { en: "Sai Kung", zh: "西貢", lat: 22.381, lon: 114.27 },
  { en: "Sha Tin", zh: "沙田", lat: 22.383, lon: 114.197 },
  { en: "Southern District", zh: "南區", lat: 22.244, lon: 114.17 },
  { en: "Tai Po", zh: "大埔", lat: 22.45, lon: 114.168 },
  { en: "Tsuen Wan", zh: "荃灣", lat: 22.371, lon: 114.114 },
  { en: "Tuen Mun", zh: "屯門", lat: 22.392, lon: 113.977 },
  { en: "Wan Chai", zh: "灣仔", lat: 22.277, lon: 114.181 },
  { en: "Yuen Long", zh: "元朗", lat: 22.445, lon: 114.022 },
  { en: "Yau Tsim Mong", zh: "油尖旺", lat: 22.311, lon: 114.17 },
  { en: "Sham Shui Po", zh: "深水埗", lat: 22.33, lon: 114.162 },
  { en: "Kowloon City", zh: "九龍城", lat: 22.323, lon: 114.191 },
  { en: "Wong Tai Sin", zh: "黃大仙", lat: 22.342, lon: 114.195 },
  { en: "Kwun Tong", zh: "觀塘", lat: 22.313, lon: 114.226 },
];

const norm = (s: string) => s.toLowerCase().replace(/\s*district$/, "").replace(/&|and/g, "").replace(/[\s'’.]/g, "");
export function findPlace(table: Place[], name: string): Place | undefined {
  const n = norm(name);
  return table.find((p) => norm(p.en) === n || p.zh === name || norm(p.zh) === n);
}
