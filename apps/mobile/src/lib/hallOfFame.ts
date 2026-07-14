import { ImageSourcePropType } from 'react-native';

// NSMQ past-champion schools, ranked by title count (highest first). Crest images live in
// assets/images/; any entry without a matching file falls back to a school-initials badge.
export const SCHOOL_IMAGES: Record<string, ImageSourcePropType> = {
  presec: require('../../assets/images/presec.png'),
  prempeh: require('../../assets/images/prempeh.jpg'),
  mfantsipim: require('../../assets/images/mfantsipim.png'),
  'st-peters': require('../../assets/images/st-peters.jpg'),
  'st-augustines': require('../../assets/images/st-augustines.jpg'),
  achimota: require('../../assets/images/achimota.jpg'),
  opoku: require('../../assets/images/opoku.jpg'),
  adisadel: require('../../assets/images/adisadel.jpg'),
  aquinas: require('../../assets/images/aquinas.jpg'),
  gsts: require('../../assets/images/gsts.jpg'),
  pope: require('../../assets/images/pope.jpg'),
};

export type HallOfFameEntry = {
  name: string;
  titles: number;
  years: number[];
  imageKey: keyof typeof SCHOOL_IMAGES;
};

export const HALL_OF_FAME: HallOfFameEntry[] = [
  { name: 'PRESEC, Legon', titles: 8, years: [1995, 2003, 2006, 2008, 2009, 2020, 2022, 2023], imageKey: 'presec' },
  { name: 'Prempeh College', titles: 5, years: [1994, 1996, 2015, 2017, 2021], imageKey: 'prempeh' },
  { name: 'Mfantsipim School', titles: 4, years: [1999, 2014, 2024, 2025], imageKey: 'mfantsipim' },
  { name: "St. Peter's SHS", titles: 3, years: [2000, 2005, 2018], imageKey: 'st-peters' },
  { name: "St. Augustine's College", titles: 2, years: [2007, 2019], imageKey: 'st-augustines' },
  { name: 'Achimota School', titles: 2, years: [1998, 2004], imageKey: 'achimota' },
  { name: 'Opoku Ware School', titles: 2, years: [1997, 2002], imageKey: 'opoku' },
  { name: 'Adisadel College', titles: 1, years: [2016], imageKey: 'adisadel' },
  { name: 'Ghana Secondary Technical School', titles: 1, years: [2012], imageKey: 'gsts' },
  { name: 'Pope John SHS & Minor Seminary', titles: 1, years: [2001], imageKey: 'pope' },
  { name: 'St. Thomas Aquinas SHS', titles: 1, years: [2013], imageKey: 'aquinas' },
];
