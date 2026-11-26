import labels from '../i18n/locales/ko-KR/admin.json';
/** Admin operations currently use Korean; business terms use the ko/en runtime locale. */
export const adminText=(key:keyof typeof labels):string=>labels[key];
