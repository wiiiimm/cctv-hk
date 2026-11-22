// Curated third-party YouTube live streams of Hong Kong. Video IDs die when a stream ends;
// the app probes liveness at runtime and shows NO SIGNAL for dead ones. Positions are
// approximate viewpoints, omitted where a stream has no single location.
export interface LiveStream {
  /** Channel number (1xx). Fixed per stream so removing one never renumbers the others (links, favourites). */
  num: number;
  id: string;
  name: string;
  nameZh: string;
  channel: string;
  lat?: number;
  lon?: number;
}

export const LIVE_STREAMS: LiveStream[] = [
  // Retired 2026-11-22: 101 TST, 102 TST street view, 104 Harbour East, 106 Causeway Bay, 107 Kwai Tsing sky,
  // 108 HOY TV, 111 HK weather map. Don't reuse those numbers for different streams. (103 came back: same stream.)
  // Not added (owner disabled embedding, so they can only ever be OFF AIR): K9Z_RrKpQTM Air-Flighting HKIA 3D,
  // NyMO5N6f490 香港天氣台 main weather stream.
  { num: 103, id: "XN-ArdUrqtc", name: "Victoria Harbour, East Kowloon", nameZh: "東九龍維港", channel: "Marcus Wong", lat: 22.3045, lon: 114.2135 },
  { num: 105, id: "TIYZVyzOk4k", name: "Victoria Peak", nameZh: "太平山頂", channel: "Relaxing Music BGM", lat: 22.2759, lon: 114.1455 },
  { num: 109, id: "ygC5wni2DMQ", name: "HKIA ATC tracker", nameZh: "香港國際機場 ATC", channel: "VHHH/HKG", lat: 22.308, lon: 113.9185 },
  { num: 110, id: "JPREngCARsA", name: "HKIA 3D air traffic", nameZh: "香港機場 3D 空中交通", channel: "VHHH ATC", lat: 22.308, lon: 113.9185 },
  { num: 112, id: "Z8NTLkEFZjg", name: "Tsim Sha Tsui", nameZh: "尖沙咀", channel: "Brainrolling Workshop", lat: 22.2955, lon: 114.1722 },
  { num: 113, id: "ZbUAX0ZvTZI", name: "Tung Chung, HZMB port & airport", nameZh: "東涌・港珠澳口岸・機場", channel: "RingBoy@介子仔", lat: 22.289, lon: 113.9425 },
  { num: 114, id: "OtreHvXgAoA", name: "Hong Kong cityscape (4K)", nameZh: "香港實時風景 (4K)", channel: "Brainrolling Workshop", lat: 22.293, lon: 114.1694 },
  { num: 115, id: "g8GNxQBRff4", name: "Prince Edward view", nameZh: "太子景觀", channel: "香港天氣台", lat: 22.3245, lon: 114.1685 },
];

/** Live streams from outside Hong Kong: bank 3xx, their own "World live" group, the country as the area. */
export interface WorldStream {
  num: number;
  id: string;
  name: string;
  nameZh: string;
  channel: string;
  country: string;
  countryZh: string;
  /** Estimated position (approximate): the named place, else the broadcaster's base / the country's main city. */
  lat?: number;
  lon?: number;
}

// Not added (owner disabled embedding, so they could only be OFF AIR): x4AlaibltlA SkylineWebcams Venice,
// tHoPC5cuvoQ SkylineWebcams USA/UK/Canada, jshwkG1ZpP8 WebcamSydney 2 panning view, 9gWIZNLV5Fk visiontvaustralia
// Sydney, fb8-ufh6e7U Melbourne City Skyline Cam.
export const WORLD_STREAMS: WorldStream[] = [
  { num: 301, id: "HfgIFGbdGJ0", name: "The World Live", nameZh: "全球實時直播", channel: "earthTV", country: "World", countryZh: "全球" },
  { num: 302, id: "5p_KGD4fJZs", name: "White House, Washington", nameZh: "華盛頓白宮", channel: "earthTV", country: "USA", countryZh: "美國", lat: 38.8977, lon: -77.0365 },
  { num: 303, id: "kUfuwa8mDrA", name: "Spain live cams", nameZh: "西班牙實時鏡頭", channel: "SkylineWebcams", country: "Spain", countryZh: "西班牙", lat: 40.4168, lon: -3.7038 },
  { num: 304, id: "OB0aUSOCvHY", name: "Greece live cams", nameZh: "希臘實時鏡頭", channel: "SkylineWebcams", country: "Greece", countryZh: "希臘", lat: 37.9838, lon: 23.7275 },
  { num: 305, id: "OLEAL-U3CiI", name: "Italy live cams", nameZh: "意大利實時鏡頭", channel: "SkylineWebcams", country: "Italy", countryZh: "意大利", lat: 41.9028, lon: 12.4964 },
  { num: 306, id: "jLm26eRhrWg", name: "Japan Now", nameZh: "日本實時", channel: "Earth Now", country: "Japan", countryZh: "日本", lat: 35.6762, lon: 139.6503 },
  { num: 307, id: "n28qm4yrGhk", name: "Iceland Now", nameZh: "冰島實時", channel: "Earth Now", country: "Iceland", countryZh: "冰島", lat: 64.1466, lon: -21.9426 },
  { num: 308, id: "xYqhMHETOgI", name: "Norway Now", nameZh: "挪威實時", channel: "Earth Now", country: "Norway", countryZh: "挪威", lat: 59.9139, lon: 10.7522 },
  { num: 309, id: "yl11N0NuHVQ", name: "South Korea Now", nameZh: "南韓實時", channel: "Earth Now", country: "South Korea", countryZh: "南韓", lat: 37.5665, lon: 126.978 },
  { num: 310, id: "YlMYlOjhF9U", name: "Sweden Now", nameZh: "瑞典實時", channel: "Earth Now", country: "Sweden", countryZh: "瑞典", lat: 59.3293, lon: 18.0686 },
  { num: 311, id: "3bc9QzqjCF8", name: "Germany Now", nameZh: "德國實時", channel: "Earth Now", country: "Germany", countryZh: "德國", lat: 52.52, lon: 13.405 },
  { num: 312, id: "Ss4UMyrvNYM", name: "Finland Now", nameZh: "芬蘭實時", channel: "Earth Now", country: "Finland", countryZh: "芬蘭", lat: 60.1699, lon: 24.9384 },
  { num: 313, id: "J4oNJrCzyzU", name: "New Zealand Now", nameZh: "新西蘭實時", channel: "Earth Now", country: "New Zealand", countryZh: "新西蘭", lat: -36.8485, lon: 174.7633 },
  { num: 314, id: "-Xtz0Jo5Ln8", name: "Brazil Now", nameZh: "巴西實時", channel: "Earth Now", country: "Brazil", countryZh: "巴西", lat: -22.9068, lon: -43.1729 },
  { num: 315, id: "5uZa3-RMFos", name: "Sydney Harbour", nameZh: "悉尼海港", channel: "WebcamSydney", country: "Australia", countryZh: "澳洲", lat: -33.8568, lon: 151.2153 },
  { num: 316, id: "hm9iAviOZ20", name: "Surfline TV — world surf cams", nameZh: "Surfline 全球衝浪鏡頭", channel: "Surfline", country: "World", countryZh: "全球" },
  { num: 317, id: "i10aOLMK76k", name: "Live cams around the world", nameZh: "全球輪播實時鏡頭", channel: "I Love You Venice", country: "World", countryZh: "全球" },
  { num: 318, id: "pIaqtdmfbZ4", name: "Brisbane weather", nameZh: "布里斯本天氣", channel: "Brisbane Live", country: "Australia", countryZh: "澳洲", lat: -27.4698, lon: 153.0251 },
  { num: 319, id: "dypAtzvl24s", name: "Port of Newcastle harbour", nameZh: "紐卡素港", channel: "Port of Newcastle", country: "Australia", countryZh: "澳洲", lat: -32.92, lon: 151.79 },
  { num: 320, id: "y0XPkjM9-P4", name: "Florida, Bahamas & Caribbean", nameZh: "佛羅里達、巴哈馬及加勒比海", channel: "PTZtv", country: "USA & Caribbean", countryZh: "美國及加勒比海", lat: 25.7617, lon: -80.1918 },
  { num: 321, id: "3nyPER2kzqk", name: "Dublin", nameZh: "都柏林", channel: "EarthCam", country: "Ireland", countryZh: "愛爾蘭", lat: 53.3498, lon: -6.2603 },
  { num: 322, id: "3IPgK1Hqx6A", name: "Sydney Harbour, McMahons Point", nameZh: "悉尼海港（麥馬漢角）", channel: "Sydney Harbour LIVE", country: "Australia", countryZh: "澳洲", lat: -33.8452, lon: 151.2041 },
  { num: 323, id: "gEbrHdFRgpQ", name: "Melbourne street intersection", nameZh: "墨爾本市中心街口", channel: "Cityscape Live", country: "Australia", countryZh: "澳洲", lat: -37.8136, lon: 144.9631 },
  { num: 324, id: "7Lu9rWg7ngI", name: "South Yarra Station, Melbourne", nameZh: "墨爾本南雅拉站", channel: "Steven Hoefel", country: "Australia", countryZh: "澳洲", lat: -37.8384, lon: 144.9925 },
  { num: 325, id: "0-xvuP6Caio", name: "West Gate Bridge, Melbourne", nameZh: "墨爾本西門大橋", channel: "Spotswood Trailers", country: "Australia", countryZh: "澳洲", lat: -37.8292, lon: 144.8994 },
  { num: 326, id: "I7OY3JC15EE", name: "Lourdes Hill College, Brisbane", nameZh: "布里斯本露德山書院", channel: "Lourdes Hill College", country: "Australia", countryZh: "澳洲", lat: -27.4653, lon: 153.0619 },
  { num: 327, id: "7dlz_g6j4Nk", name: "Brisbane Airport", nameZh: "布里斯本機場", channel: "LJK Aviation - BNE", country: "Australia", countryZh: "澳洲", lat: -27.3942, lon: 153.1218 },
  { num: 328, id: "TcLr3G3R-7A", name: "UQ Pitch Drop Experiment", nameZh: "昆士蘭大學瀝青滴漏實驗", channel: "UQ Pitch Drop Experiment", country: "Australia", countryZh: "澳洲", lat: -27.4975, lon: 153.0137 },
  { num: 329, id: "uDBYuEV4zjI", name: "Heathrow Airport, London", nameZh: "倫敦希斯路機場", channel: "BIG JET TV", country: "UK", countryZh: "英國", lat: 51.47, lon: -0.4543 },
  { num: 359, id: "TpDRujkAVNE", name: "Earth LIVE: quakes, storms, fires", nameZh: "地球實況：地震、風暴、山火", channel: "Acta Diurna Live", country: "World", countryZh: "全球" },
  { num: 360, id: "9PvjjhcwEYU", name: "Border Security (24/7 episodes)", nameZh: "邊境保衛戰（24小時重播）", channel: "Border Security", country: "World", countryZh: "全球" },
  // EarthCam (@earthcam/streams), live on 2026-11-22 — first page of the channel's Streams tab only.
  { num: 330, id: "W9ghgZD6Ugw", name: "Chicago Skydeck", nameZh: "芝加哥天空甲板", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 41.8789, lon: -87.6359 },
  { num: 331, id: "ZxCeWQ3Lcig", name: "Times Square North (4K)", nameZh: "紐約時代廣場北", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.759, lon: -73.9845 },
  { num: 332, id: "Syl86r2ChtM", name: "EarthCamTV 3: trending cams", nameZh: "EarthCamTV 3 熱門鏡頭", channel: "EarthCam", country: "World", countryZh: "全球" },
  { num: 333, id: "mG2gAWY_Guw", name: "Washington Monument", nameZh: "華盛頓紀念碑", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 38.8895, lon: -77.0353 },
  { num: 334, id: "mNtcktpcbtU", name: "Giraffe paddock, Greenville SC", nameZh: "格林維爾長頸鹿園", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 34.8447, lon: -82.3858 },
  { num: 335, id: "8ShrAk0RPrQ", name: "Giraffe barn, Greenville SC", nameZh: "格林維爾長頸鹿棚", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 34.8447, lon: -82.3858 },
  { num: 336, id: "WHve7zk9jds", name: "Spirit Lake, Iowa", nameZh: "愛荷華州靈湖", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 43.4222, lon: -95.1022 },
  { num: 337, id: "TPGY7UYzbKw", name: "Snowman Cam, Gaylord MI", nameZh: "密歇根州蓋洛德雪人鏡頭", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 45.0275, lon: -84.6748 },
  { num: 338, id: "P3sGke9M59o", name: "Philadelphia", nameZh: "費城", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 39.9526, lon: -75.1652 },
  { num: 339, id: "YeEMPcYCbgQ", name: "Cayman Islands", nameZh: "開曼群島", channel: "EarthCam", country: "Cayman Islands", countryZh: "開曼群島", lat: 19.2869, lon: -81.3674 },
  { num: 340, id: "xqdukYhcGEU", name: "New Orleans street view", nameZh: "新奧爾良街景", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 29.9584, lon: -90.0651 },
  { num: 341, id: "wiVzU1mcCTA", name: "Tamariu", nameZh: "塔馬里烏", channel: "EarthCam", country: "Spain", countryZh: "西班牙", lat: 41.9178, lon: 3.2072 },
  { num: 342, id: "QxFFjXu_zqs", name: "New Orleans balcony view", nameZh: "新奧爾良露台景", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 29.9584, lon: -90.0651 },
  { num: 343, id: "KHy_n-EMWY8", name: "Times Square Crossroads", nameZh: "紐約時代廣場十字路口", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.758, lon: -73.9855 },
  { num: 344, id: "OSI8qWMoK5E", name: "Flight 93 Memorial, Tower of Voices", nameZh: "93號航班紀念碑", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.051, lon: -78.9045 },
  { num: 345, id: "o5Ie_LpZ9uk", name: "Statue of Liberty", nameZh: "自由神像", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.6892, lon: -74.0445 },
  { num: 346, id: "ZYQlLQHz2Mg", name: "9/11 Memorial & Museum", nameZh: "九一一紀念館", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.7115, lon: -74.0134 },
  { num: 347, id: "EiUyBIcG4fQ", name: "Midway Airport, Chicago", nameZh: "芝加哥中途機場", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 41.7868, lon: -87.7522 },
  { num: 348, id: "tErYxn2UM5Y", name: "Brooklyn Bridge", nameZh: "布魯克林大橋", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.7061, lon: -73.9969 },
  { num: 349, id: "zMCea32gpmg", name: "Abbey Road crossing, London", nameZh: "倫敦艾比路斑馬線", channel: "EarthCam", country: "UK", countryZh: "英國", lat: 51.532, lon: -0.1779 },
  { num: 350, id: "Ez6xC43MMTQ", name: "Madison, Indiana", nameZh: "印第安納州麥迪遜", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 38.7359, lon: -85.3799 },
  { num: 351, id: "OBgCrw-IyhE", name: "Seaside Heights NJ, north view", nameZh: "新澤西州海濱高地", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 39.944, lon: -74.0729 },
  { num: 352, id: "jtdyLykT_XY", name: "Mallorca", nameZh: "馬略卡島", channel: "EarthCam", country: "Spain", countryZh: "西班牙", lat: 39.5696, lon: 2.6502 },
  { num: 353, id: "6tq8S2pp8PQ", name: "Pigeon River, Hartford TN", nameZh: "田納西州鴿子河", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 35.8173, lon: -83.1449 },
  { num: 354, id: "VWDi2Po3ZsQ", name: "World's Largest Buffalo, Jamestown ND", nameZh: "北達科他州巨型水牛像", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 46.9105, lon: -98.7084 },
  { num: 355, id: "F1EQEDL4ddU", name: "Liberty Bell & Independence Hall", nameZh: "自由鐘及獨立廳", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 39.9496, lon: -75.1503 },
  { num: 356, id: "qsrevo5Vdkw", name: "Council Bluffs, Iowa", nameZh: "愛荷華州康瑟爾布拉夫斯", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 41.2619, lon: -95.8608 },
  { num: 357, id: "4LTSTw4jnZc", name: "Sanibel Island", nameZh: "薩尼貝爾島", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 26.4434, lon: -82.1115 },
  { num: 358, id: "5C9oM7C2Q9k", name: "World Trade Center, New York", nameZh: "紐約世貿中心", channel: "EarthCam", country: "USA", countryZh: "美國", lat: 40.7127, lon: -74.0134 },
];

/** 24/7 news (and finance) channels: bank 4xx, grouped by language / region in the "News & finance" section. */
export interface NewsStream {
  num: number;
  id: string;
  name: string;
  nameZh: string;
  channel: string;
  /** Where the broadcaster is based. */
  country: string;
  countryZh: string;
  /** Broadcast language: yue Cantonese, cmn Mandarin, en English, ja / ko / tl / ur. */
  lang: "yue" | "cmn" | "en" | "ja" | "ko" | "tl" | "ur";
  /** Asia-Pacific broadcaster (HK, mainland, Taiwan, Singapore, Japan, Korea, Australia, South / Southeast Asia). */
  apac?: boolean;
  /** Business / markets channel. */
  finance?: boolean;
  /** Estimated position (approximate): the named place, else the broadcaster's base / the country's main city. */
  lat?: number;
  lon?: number;
}

// All checked live and embeddable on 2026-11-22. None of TVB / Now / i-Cable / RTHK runs a public 24/7 YouTube stream
// right now, so there is no Cantonese channel yet. Not added (embedding off): sRgR9c1WeH8 TimeAtlas market clocks.
export const NEWS_STREAMS: NewsStream[] = [
  // Hong Kong / mainland China
  { num: 401, id: "Ry--eMIjYLQ", name: "Phoenix TV 24-hour live", nameZh: "鳳凰衛視 24小時直播間", channel: "鳳凰衛視 PhoenixTV", country: "Hong Kong", countryZh: "香港", lang: "cmn", apac: true, lat: 22.4501, lon: 114.183 },
  { num: 402, id: "0i7n3r01L2U", name: "CGTN", nameZh: "中國環球電視網 CGTN", channel: "CGTN", country: "China", countryZh: "中國", lang: "en", apac: true, lat: 39.9042, lon: 116.4074 },
  // Taiwan
  { num: 403, id: "2mCSYvcfhtc", name: "TVBS News (55)", nameZh: "TVBS 新聞台 (55)", channel: "TVBS NEWS", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.0797, lon: 121.5745 },
  { num: 404, id: "o_-hSMgpAzs", name: "TVBS (56)", nameZh: "TVBS 56頻道", channel: "TVBS選新聞", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.0797, lon: 121.5745 },
  { num: 405, id: "m_dhMSvUCIc", name: "TVBS online exclusive", nameZh: "TVBS 網路獨家新聞", channel: "TVBS NEWS", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.0797, lon: 121.5745 },
  { num: 406, id: "ylYJSBUgaMA", name: "FTV News", nameZh: "民視新聞", channel: "民視新聞網", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 407, id: "wM0g8EoUZ_E", name: "CTS News", nameZh: "華視新聞", channel: "華視新聞 CH52", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 408, id: "V1p33hqPrUk", name: "EBC News (51)", nameZh: "東森新聞 (51)", channel: "東森新聞 CH51", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 409, id: "vr3XyVCR4T0", name: "CTi News", nameZh: "中天新聞", channel: "中天電視", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 410, id: "-Bk_tdwVDPQ", name: "CTi talk shows", nameZh: "中天深喉嚨", channel: "中天深喉嚨", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 411, id: "hg4nYb3jE9A", name: "PTS News", nameZh: "公視新聞", channel: "公視新聞網", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 412, id: "9iRAqBMakXY", name: "TTV News", nameZh: "台視新聞", channel: "台視新聞 TTV NEWS", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  { num: 413, id: "6IquAgfvYmc", name: "Global News TV", nameZh: "寰宇新聞", channel: "寰宇新聞", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  // Singapore and the rest of Asia-Pacific
  { num: 414, id: "-PWMxjBgr0k", name: "CNA", nameZh: "亞洲新聞台 CNA", channel: "CNA", country: "Singapore", countryZh: "新加坡", lang: "en", apac: true, lat: 1.2996, lon: 103.7876 },
  { num: 415, id: "IimtbuqYIE8", name: "NHK World-Japan News", nameZh: "NHK 世界新聞", channel: "NHK WORLD-JAPAN", country: "Japan", countryZh: "日本", lang: "en", apac: true, lat: 35.6648, lon: 139.6966 },
  { num: 416, id: "coYw-eVU0Ks", name: "TV Asahi News24", nameZh: "朝日電視台 NEWS24", channel: "ANNnewsCH", country: "Japan", countryZh: "日本", lang: "ja", apac: true, lat: 35.6596, lon: 139.7292 },
  { num: 417, id: "OxQQsIvJTTU", name: "KBS Korea", nameZh: "KBS 韓國", channel: "KBS WORLD TV", country: "South Korea", countryZh: "南韓", lang: "ko", apac: true, lat: 37.5249, lon: 126.9175 },
  { num: 418, id: "aZyD6EPl6KU", name: "YTN", nameZh: "YTN 韓國新聞", channel: "YTN", country: "South Korea", countryZh: "南韓", lang: "ko", apac: true, lat: 37.5793, lon: 126.8894 },
  { num: 419, id: "vOTiJkg1voo", name: "ABC News Australia", nameZh: "澳洲 ABC 新聞", channel: "ABC News (Australia)", country: "Australia", countryZh: "澳洲", lang: "en", apac: true, lat: -33.8803, lon: 151.1973 },
  { num: 420, id: "Ereua4kbGWI", name: "News24 Australia", nameZh: "澳洲 News24", channel: "News24 (Sky News Australia)", country: "Australia", countryZh: "澳洲", lang: "en", apac: true, lat: -33.7765, lon: 151.1243 },
  { num: 421, id: "X-7LAkvfA5s", name: "WION", nameZh: "WION 印度國際新聞", channel: "WION", country: "India", countryZh: "印度", lang: "en", apac: true, lat: 28.5355, lon: 77.391 },
  { num: 422, id: "VzS75VuvLxs", name: "DZRH News", nameZh: "菲律賓 DZRH 新聞", channel: "DZRH News Television", country: "Philippines", countryZh: "菲律賓", lang: "tl", apac: true, lat: 14.5995, lon: 120.9842 },
  { num: 423, id: "Pzv58lUgiVo", name: "GNN Pakistan", nameZh: "巴基斯坦 GNN", channel: "GNN", country: "Pakistan", countryZh: "巴基斯坦", lang: "ur", apac: true, lat: 31.5204, lon: 74.3587 },
  { num: 424, id: "9lLVNq4lWVk", name: "Aaj News Pakistan", nameZh: "巴基斯坦 Aaj 新聞", channel: "Aaj News", country: "Pakistan", countryZh: "巴基斯坦", lang: "ur", apac: true, lat: 24.8607, lon: 67.0011 },
  // International
  { num: 425, id: "GotlA1KKWoo", name: "CNN Headlines", nameZh: "CNN 頭條", channel: "CNN", country: "USA", countryZh: "美國", lang: "en", lat: 33.7577, lon: -84.3946 },
  { num: 426, id: "-NabWfv-VdA", name: "BBC News", nameZh: "BBC 新聞", channel: "BBC News", country: "UK", countryZh: "英國", lang: "en", lat: 51.5188, lon: -0.1439 },
  { num: 427, id: "gCNeDWCI0vo", name: "Al Jazeera English", nameZh: "半島電視台英語", channel: "Al Jazeera English", country: "Qatar", countryZh: "卡塔爾", lang: "en", lat: 25.3142, lon: 51.4974 },
  { num: 428, id: "LuKwFajn37U", name: "DW News", nameZh: "德國之聲", channel: "DW News", country: "Germany", countryZh: "德國", lang: "en", lat: 52.5096, lon: 13.383 },
  { num: 429, id: "HvZt-nh9sGg", name: "France 24 English", nameZh: "法國24 英語", channel: "FRANCE 24 English", country: "France", countryZh: "法國", lang: "en", lat: 48.8282, lon: 2.2611 },
  { num: 430, id: "53SxFKpbKDE", name: "Sky News", nameZh: "天空新聞", channel: "Sky News", country: "UK", countryZh: "英國", lang: "en", lat: 51.4865, lon: -0.3245 },
  { num: 431, id: "pykpO5kQJ98", name: "Euronews English", nameZh: "歐洲新聞台英語", channel: "euronews", country: "Europe", countryZh: "歐洲", lang: "en", lat: 45.7385, lon: 4.8175 },
  { num: 432, id: "KQhNZQ_Uag8", name: "ABC News Live", nameZh: "美國 ABC 新聞", channel: "ABC News", country: "USA", countryZh: "美國", lang: "en", lat: 40.771, lon: -73.9876 },
  { num: 433, id: "pJZBppLlwJo", name: "NBC News NOW", nameZh: "NBC 新聞", channel: "NBC News", country: "USA", countryZh: "美國", lang: "en", lat: 40.7587, lon: -73.9787 },
  { num: 434, id: "C96oohpWBGw", name: "LiveNOW from FOX", nameZh: "FOX LiveNOW", channel: "LiveNOW from FOX", country: "USA", countryZh: "美國", lang: "en", lat: 40.7614, lon: -73.9776 },
  // Finance / business / markets
  { num: 435, id: "QB5BNdBFujE", name: "Bloomberg Business News", nameZh: "彭博商業新聞", channel: "Bloomberg Television", country: "USA", countryZh: "美國", lang: "en", finance: true, lat: 40.7623, lon: -73.9681 },
  { num: 436, id: "KQp-e_XQnDE", name: "Yahoo Finance", nameZh: "雅虎財經", channel: "Yahoo Finance", country: "USA", countryZh: "美國", lang: "en", finance: true, lat: 40.7537, lon: -73.9857 },
  { num: 437, id: "1I2iq41Akmo", name: "EBC Financial News", nameZh: "東森財經新聞", channel: "57東森財經新聞", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, finance: true, lat: 25.033, lon: 121.5654 },
  { num: 438, id: "AEBeWMM1atA", name: "EBC markets (stocks)", nameZh: "東森財經股市直播", channel: "57東森財經新聞", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, finance: true, lat: 25.033, lon: 121.5654 },
  { num: 439, id: "eA6Aczd3FZM", name: "USTV finance", nameZh: "非凡財經", channel: "USTV 非凡電視", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, finance: true, lat: 25.033, lon: 121.5654 },
  // More international / local English news
  { num: 440, id: "EDbWwVR7i9Q", name: "GB News", nameZh: "GB 新聞", channel: "GBNews", country: "UK", countryZh: "英國", lang: "en", lat: 51.5186, lon: -0.1795 },
  { num: 441, id: "tvXWIgsWuK0", name: "TVP World", nameZh: "波蘭 TVP World", channel: "TVP WORLD", country: "Poland", countryZh: "波蘭", lang: "en", lat: 52.2297, lon: 21.0122 },
  { num: 442, id: "s3iVFJoxrYc", name: "ABC7 Eyewitness News, Los Angeles", nameZh: "洛杉磯 ABC7 新聞", channel: "ABC7", country: "USA", countryZh: "美國", lang: "en", lat: 34.1564, lon: -118.2563 },
  { num: 443, id: "OWa4603KGkQ", name: "ABC30 Central California", nameZh: "加州中部 ABC30 新聞", channel: "ABC30 Action News", country: "USA", countryZh: "美國", lang: "en", lat: 36.7378, lon: -119.7871 },
  { num: 444, id: "YUJl2vWNsWU", name: "ABC7 News Bay Area", nameZh: "三藩市灣區 ABC7 新聞", channel: "ABC7 News Bay Area", country: "USA", countryZh: "美國", lang: "en", lat: 37.7953, lon: -122.3998 },
  { num: 445, id: "f39oHo6vFLg", name: "Bloomberg Live (weekdays)", nameZh: "彭博直播（平日）", channel: "Bloomberg Podcasts", country: "USA", countryZh: "美國", lang: "en", finance: true, lat: 40.7623, lon: -73.9681 },
  { num: 446, id: "OHt8RHPdxrw", name: "CBC News British Columbia", nameZh: "加拿大 CBC 卑詩省新聞", channel: "CBC British Columbia", country: "Canada", countryZh: "加拿大", lang: "en", lat: 49.2797, lon: -123.1137 },
  { num: 447, id: "BZ2eIuu0m_k", name: "FOX 13 Seattle", nameZh: "西雅圖 FOX 13 新聞", channel: "FOX 13 Seattle", country: "USA", countryZh: "美國", lang: "en", lat: 47.6062, lon: -122.3321 },
  { num: 448, id: "E0zhe2gkXBs", name: "EBC News (51), second feed", nameZh: "東森新聞 (51) 第二線", channel: "東森新聞 CH51", country: "Taiwan", countryZh: "台灣", lang: "cmn", apac: true, lat: 25.033, lon: 121.5654 },
  // APT (@apt_news): event streams, they end when the event does.
  { num: 449, id: "ptOzNkoV6ZI", name: "APT World News", nameZh: "APT 國際新聞", channel: "APT", country: "International", countryZh: "國際", lang: "en" },
  { num: 450, id: "jn0rxoHXxbo", name: "APEC reception, Shenzhen", nameZh: "深圳 APEC 歡迎晚宴", channel: "APT", country: "International", countryZh: "國際", lang: "en", lat: 22.5431, lon: 114.0579 },
  { num: 451, id: "424pFBnA4Hk", name: "Mark Carney at the Press Gallery Dinner", nameZh: "加拿大總理卡尼出席記者晚宴", channel: "APT", country: "International", countryZh: "國際", lang: "en", lat: 45.4215, lon: -75.6972 },
];

/** Space: the ISS and launch sites, bank 5xx, the "Space" group. */
export interface SpaceStream {
  num: number;
  id: string;
  name: string;
  nameZh: string;
  channel: string;
  /** Where it looks from / at. */
  place: string;
  placeZh: string;
  /** Estimated position (approximate): the named place, else the broadcaster's base / the country's main city. */
  lat?: number;
  lon?: number;
}

// Checked live and embeddable 2026-11-22.
export const SPACE_STREAMS: SpaceStream[] = [
  { num: 501, id: "ROboUHfPUrU", name: "ISS: high-definition Earth views", nameZh: "國際太空站高清地球景觀", channel: "NASA", place: "ISS", placeZh: "國際太空站" },
  { num: 502, id: "M3HKLzjvKPc", name: "ISS: live video", nameZh: "國際太空站直播", channel: "NASA", place: "ISS", placeZh: "國際太空站" },
  { num: 503, id: "fO9e9jnhYK8", name: "Earth from the ISS (4K)", nameZh: "國際太空站 4K 地球直播", channel: "Sen", place: "ISS", placeZh: "國際太空站" },
  { num: 504, id: "Jm8wRjD3xVA", name: "Space Coast: Cape Canaveral & KSC", nameZh: "太空海岸：卡納維爾角及甘迺迪太空中心", channel: "NASASpaceflight", place: "Florida", placeZh: "佛羅里達", lat: 28.4889, lon: -80.5778 },
  { num: 505, id: "XTNRGKHiZNg", name: "Kennedy Space Center Cape Cam", nameZh: "甘迺迪太空中心", channel: "Avid Space", place: "Florida", placeZh: "佛羅里達", lat: 28.5729, lon: -80.649 },
  { num: 506, id: "tqO3cQELieE", name: "Port Canaveral (SpaceX boats)", nameZh: "卡納維爾港（SpaceX 回收船）", channel: "Avid Space", place: "Florida", placeZh: "佛羅里達", lat: 28.4108, lon: -80.619 },
  { num: 507, id: "mhJRzQsLZGg", name: "Starbase: Starship & Super Heavy", nameZh: "星艦基地：星艦及超重型助推器", channel: "NASASpaceflight", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 508, id: "I0Ps8qYuyAg", name: "Starbase multi-cam", nameZh: "星艦基地多鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 509, id: "9WFCrf9H3IA", name: "Starbase from Rocket Ranch", nameZh: "星艦基地（Rocket Ranch）", channel: "RGV Aerial Photography", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 510, id: "cOmmvhDQ2HM", name: "McGregor engine test site", nameZh: "SpaceX 麥格雷戈引擎測試場", channel: "NASASpaceflight", place: "McGregor, Texas", placeZh: "德州麥格雷戈", lat: 31.406, lon: -97.43 },
  // From a "space x live" search.
  { num: 511, id: "thfYPsRqxmw", name: "Launch Pad Live: Cape Canaveral", nameZh: "發射台直播：卡納維爾角", channel: "Spaceflight Now", place: "Florida", placeZh: "佛羅里達", lat: 28.4889, lon: -80.5778 },
  { num: 512, id: "9xp1cxAuo-g", name: "Starbase live views", nameZh: "星艦基地實況", channel: "The Launch Pad", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 513, id: "o4JNr9IMQx4", name: "Starbase activity 24/7", nameZh: "星艦基地 24 小時", channel: "What about it!?", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 514, id: "tS2PHJmvJzo", name: "Starbase Rover 2.0 cam", nameZh: "星艦基地 Rover 2.0 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 515, id: "inCQ49QGmqQ", name: "Starbase Rover cam", nameZh: "星艦基地 Rover 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 516, id: "TyXUaqscyiU", name: "Starbase Rover 3 cam", nameZh: "星艦基地 Rover 3 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 517, id: "IQV0DlS1Ew0", name: "Starbase Sentinel cam", nameZh: "星艦基地 Sentinel 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 518, id: "B89oRmywnJo", name: "Starbase Nerdle cam", nameZh: "星艦基地 Nerdle 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 519, id: "1_XLpEKtW8Y", name: "Starbase Lab cam", nameZh: "星艦基地 Lab 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 520, id: "WLyUCY2lh0M", name: "Starbase Sapphire cam", nameZh: "星艦基地 Sapphire 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 521, id: "qw3uaLRrYNY", name: "Starbase Rocket Ranch cam", nameZh: "星艦基地 Rocket Ranch 鏡頭", channel: "Avid Space", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  // Added on request; 522–526 are launch broadcasts (one-off, may end), 528 / 530 are looped footage, not live views.
  { num: 522, id: "itg2FAfLG1s", name: "Falcon 9 Starlink launch, California", nameZh: "獵鷹9號星鏈發射（加州）", channel: "APT", place: "California", placeZh: "加州", lat: 34.742, lon: -120.5724 },
  { num: 523, id: "PxTeU6KQwyY", name: "Starship orbital flight", nameZh: "星艦軌道飛行", channel: "APT", place: "Starbase, Texas", placeZh: "德州星艦基地", lat: 25.9972, lon: -97.156 },
  { num: 524, id: "xrtx7BEkV14", name: "CRS-35 splashdown & ISS view", nameZh: "CRS-35 濺落及國際太空站景觀", channel: "Moter World", place: "ISS", placeZh: "國際太空站" },
  { num: 525, id: "um48_-sSFrE", name: "Falcon 9 NRO launch, California", nameZh: "獵鷹9號美國偵察衛星發射（加州）", channel: "Spaceflight Now", place: "California", placeZh: "加州", lat: 34.742, lon: -120.5724 },
  { num: 526, id: "2MjwIb89ftc", name: "USSF-317 launch", nameZh: "USSF-317 軍事發射", channel: "NDTV World", place: "Florida", placeZh: "佛羅里達", lat: 28.4889, lon: -80.5778 },
  { num: 527, id: "s-bNqv5Wvv4", name: "ISS real-time tracking & Earth views", nameZh: "國際太空站實時追蹤", channel: "Tomorrow Frontier", place: "ISS", placeZh: "國際太空站" },
  { num: 528, id: "3F0XlKxaqbk", name: "ISS spacewalk footage (ambient)", nameZh: "國際太空站太空漫步片段", channel: "WorldCam", place: "ISS", placeZh: "國際太空站" },
  { num: 529, id: "gZa9xUursO4", name: "Kennedy Space Center launches", nameZh: "甘迺迪太空中心發射", channel: "afarTV", place: "Florida", placeZh: "佛羅里達", lat: 28.5729, lon: -80.649 },
  { num: 530, id: "WCvtgdYhL_4", name: "Mars footage", nameZh: "火星影像", channel: "ElderFox Documentaries", place: "Mars", placeZh: "火星" },
];
