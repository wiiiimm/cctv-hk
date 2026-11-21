// Curated third-party YouTube live streams of Hong Kong. Video IDs die when a stream ends;
// the app probes liveness at runtime and shows NO SIGNAL for dead ones. Positions are
// approximate viewpoints, omitted where a stream has no single location.
export interface LiveStream {
  id: string;
  name: string;
  nameZh: string;
  channel: string;
  lat?: number;
  lon?: number;
}

export const LIVE_STREAMS: LiveStream[] = [
  { id: "jmwM1hA3JE0", name: "Tsim Sha Tsui", nameZh: "尖沙咀", channel: "陪您休閒上班看風景", lat: 22.2955, lon: 114.1722 },
  { id: "Fwr8lBTaBtE", name: "Tsim Sha Tsui street view", nameZh: "尖沙咀鬧市風景", channel: "沉浸式減壓音樂", lat: 22.2988, lon: 114.1722 },
  { id: "XN-ArdUrqtc", name: "Victoria Harbour, East Kowloon", nameZh: "東九龍維港", channel: "Country & Folk bgm", lat: 22.3045, lon: 114.2135 },
  { id: "6YYmUo2TgJ0", name: "Victoria Harbour East", nameZh: "維多利亞港東面", channel: "HK Live Cam", lat: 22.2905, lon: 114.2055 },
  { id: "TIYZVyzOk4k", name: "Victoria Peak", nameZh: "太平山頂", channel: "Relaxing Music BGM", lat: 22.2759, lon: 114.1455 },
  { id: "WkcmApaOvWc", name: "Causeway Bay", nameZh: "銅鑼灣", channel: "4K 減壓音樂", lat: 22.2802, lon: 114.1838 },
  { id: "O1oQhMlBiOA", name: "Kwai Tsing sky", nameZh: "葵青區天空", channel: "即時天氣｜雲朵流動", lat: 22.3547, lon: 114.1282 },
  { id: "gjN3_AIowt8", name: "HOY TV", nameZh: "HOY TV 直播", channel: "HOY 媒體網絡" },
  { id: "ygC5wni2DMQ", name: "HKIA ATC tracker", nameZh: "香港國際機場 ATC", channel: "VHHH/HKG", lat: 22.308, lon: 113.9185 },
  { id: "JPREngCARsA", name: "HKIA 3D air traffic", nameZh: "香港機場 3D 空中交通", channel: "VHHH ATC", lat: 22.308, lon: 113.9185 },
  { id: "eSm_NTKduV4", name: "HK weather map", nameZh: "香港實時天氣地圖", channel: "HKWind 各區風速雨量" },
];
