/**
 * 证件照场景配置
 *
 * 将"用户想办什么事"映射到 尺寸+底色+着装要求，
 * 消除用户对规格的困惑（痛点 #1：规格混乱）
 */

export interface SceneConfig {
  /** 唯一标识 */
  id: string;
  /** 分类 */
  category: '证件办理' | '出国签证' | '考试报名' | '求职招聘' | '其他用途';
  /** 场景名称 */
  name: string;
  /** 显示图标 */
  icon: string;
  /** 热度（用于排序，越大越靠前） */
  popularity: number;
  /** 对应 sizeId (PHOTO_SIZES) */
  sizeId: string;
  /** 对应背景色 (BG_COLORS 的 value) */
  bgColor: string;
  /** 拍摄/着装提示 */
  tips: string[];
  /** 头部占比要求（用于合规检测） */
  headRatio: { min: number; max: number };
  /** 是否允许微笑 */
  allowSmile: boolean;
  /** 是否允许戴眼镜 */
  allowGlasses: boolean;
}

export const SCENES: SceneConfig[] = [
  {
    id: 'passport',
    category: '证件办理',
    name: '护照 / 港澳通行证',
    icon: '🛂',
    popularity: 99,
    sizeId: 'large1',
    bgColor: '#4476C7',
    tips: ['深色上衣', '双耳必须露出', '不得戴首饰', '不得化浓妆', '正面免冠', '表情自然不露齿'],
    headRatio: { min: 0.67, max: 0.75 },
    allowSmile: false,
    allowGlasses: false,
  },
  {
    id: 'idcard',
    category: '证件办理',
    name: '身份证',
    icon: '🆔',
    popularity: 98,
    sizeId: 'idcard',
    bgColor: '#FFFFFF',
    tips: ['深色上衣', '不着制服', '不戴首饰', '不化浓妆', '自然表情', '不露齿'],
    headRatio: { min: 0.65, max: 0.75 },
    allowSmile: false,
    allowGlasses: false,
  },
  {
    id: 'drivers_license',
    category: '证件办理',
    name: '驾驶证',
    icon: '🚗',
    popularity: 85,
    sizeId: 'small1',
    bgColor: '#FFFFFF',
    tips: ['白底', '近期照片', '不着制服', '不化浓妆'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'residence_permit',
    category: '证件办理',
    name: '居住证',
    icon: '📋',
    popularity: 60,
    sizeId: '1inch',
    bgColor: '#FFFFFF',
    tips: ['白色背景', '正面免冠', '深色上衣'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'social_security',
    category: '证件办理',
    name: '社保卡',
    icon: '💳',
    popularity: 70,
    sizeId: '1inch',
    bgColor: '#FFFFFF',
    tips: ['白色背景', '正面免冠', '深色上衣'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'us_visa',
    category: '出国签证',
    name: '美国签证',
    icon: '🇺🇸',
    popularity: 75,
    sizeId: 'visa',
    bgColor: '#FFFFFF',
    tips: ['51mm×51mm 方型照片', '白色背景', '露出额头和双耳', '不得戴眼镜'],
    headRatio: { min: 0.5, max: 0.69 },
    allowSmile: false,
    allowGlasses: false,
  },
  {
    id: 'schengen_visa',
    category: '出国签证',
    name: '申根签证',
    icon: '🇪🇺',
    popularity: 65,
    sizeId: '2inch',
    bgColor: '#FFFFFF',
    tips: ['35×45mm', '白色背景', '浅色背景不戴浅色衣服', '面部无遮挡'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: false,
    allowGlasses: true,
  },
  {
    id: 'japan_visa',
    category: '出国签证',
    name: '日本签证',
    icon: '🇯🇵',
    popularity: 60,
    sizeId: '2inch',
    bgColor: '#FFFFFF',
    tips: ['45×45mm 正方形', '白色背景', '正面免冠', '眼镜不得反光'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: false,
    allowGlasses: true,
  },
  {
    id: 'uk_visa',
    category: '出国签证',
    name: '英国签证',
    icon: '🇬🇧',
    popularity: 55,
    sizeId: '2inch',
    bgColor: '#FFFFFF',
    tips: ['35×45mm', '白色背景', '面部无遮挡'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: false,
    allowGlasses: true,
  },
  {
    id: 'resume',
    category: '求职招聘',
    name: '求职简历',
    icon: '💼',
    popularity: 90,
    sizeId: '1inch',
    bgColor: '#4476C7',
    tips: ['建议蓝色背景', '微笑自然', '正装/衬衣最佳', '精神饱满'],
    headRatio: { min: 0.5, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'linkedin',
    category: '求职招聘',
    name: 'LinkedIn / 职场头像',
    icon: '👔',
    popularity: 55,
    sizeId: '1inch',
    bgColor: '#4476C7',
    tips: ['蓝色渐变背景', '微笑自信', '商务休闲着装'],
    headRatio: { min: 0.4, max: 0.6 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'kaoyan',
    category: '考试报名',
    name: '考研报名',
    icon: '🎓',
    popularity: 80,
    sizeId: 'large1',
    bgColor: '#4476C7',
    tips: ['蓝色背景', '免冠正面', '不得使用修图软件', '近3个月内照片'],
    headRatio: { min: 0.67, max: 0.75 },
    allowSmile: false,
    allowGlasses: false,
  },
  {
    id: 'teacher_cert',
    category: '考试报名',
    name: '教师资格证',
    icon: '📚',
    popularity: 65,
    sizeId: 'large1',
    bgColor: '#FFFFFF',
    tips: ['白色背景', '免冠正面', '深色上衣'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'civil_service',
    category: '考试报名',
    name: '公务员考试',
    icon: '🏛️',
    popularity: 70,
    sizeId: '2inch',
    bgColor: '#4476C7',
    tips: ['蓝色背景', '不得化浓妆', '不得戴首饰'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: false,
    allowGlasses: true,
  },
  {
    id: 'college_english',
    category: '考试报名',
    name: '大学英语四六级',
    icon: '📝',
    popularity: 60,
    sizeId: '1inch',
    bgColor: '#4476C7',
    tips: ['蓝色背景', '正面免冠', '近期照片'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'marriage',
    category: '证件办理',
    name: '结婚证',
    icon: '💑',
    popularity: 40,
    sizeId: 'large2',
    bgColor: '#E53935',
    tips: ['红色背景', '双人合影照片', '可穿浅色/白色上衣', '不得使用婚纱照'],
    headRatio: { min: 0.5, max: 0.7 },
    allowSmile: true,
    allowGlasses: true,
  },
  {
    id: 'military',
    category: '证件办理',
    name: '军人/警官证件',
    icon: '🎖️',
    popularity: 20,
    sizeId: '1inch',
    bgColor: '#4476C7',
    tips: ['蓝色背景', '着制服/正装', '标准严肃', '免冠'],
    headRatio: { min: 0.6, max: 0.7 },
    allowSmile: false,
    allowGlasses: true,
  },
];

/** 按热度排序 */
export function getScenesByCategory(): Record<string, SceneConfig[]> {
  const grouped: Record<string, SceneConfig[]> = {};
  const sorted = [...SCENES].sort((a, b) => b.popularity - a.popularity);
  for (const scene of sorted) {
    if (!grouped[scene.category]) grouped[scene.category] = [];
    grouped[scene.category].push(scene);
  }
  return grouped;
}

/** 搜索场景 */
export function searchScenes(query: string): SceneConfig[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return SCENES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.category.includes(query),
  ).sort((a, b) => b.popularity - a.popularity);
}

/** 热门场景（热度前6） */
export function getHotScenes(): SceneConfig[] {
  return [...SCENES].sort((a, b) => b.popularity - a.popularity).slice(0, 6);
}
