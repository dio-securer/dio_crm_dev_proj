import type {RecordSpec} from './ConfiguredRecords';
export const platformCodesSpec:RecordSpec={screen:'HQ_ADMIN_CODES',path:'/api/hq/admin/common-codes',title:{ko:'공통코드',en:'Common codes'},createAction:'ADM.codes.save',saveAction:'ADM.codes.save',version:{field:'adminCode.version',column:'version',input:'expectedVersion'},fields:[
 {id:'adminCode.groupCode',column:'group_code',input:'groupCode',required:true,writeIn:['create']},
 {id:'adminCode.code',column:'code',input:'code',required:true,writeIn:['create']},
 {id:'adminCode.label',column:'code_name',input:'label',required:true},
 {id:'adminCode.labelKo',column:'label_ko',input:'labelKo',clearValue:null},
 {id:'adminCode.labelEn',column:'label_en',input:'labelEn',clearValue:null},
 {id:'adminCode.active',column:'is_active',input:'active',type:'boolean'},
 {id:'adminCode.sortOrder',column:'sort_order',input:'sortOrder',type:'number'},
 {id:'adminCode.localOverride',column:'local_override',type:'boolean'}
]};
export const platformUsersSpec:RecordSpec={screen:'HQ_ADMIN_USERS',path:'/api/hq/admin/users',title:{ko:'사용자 관리',en:'Users'},saveAction:'ADM.users.save',version:{field:'platformUser.version',column:'version',input:'expectedVersion'},fields:[
 {id:'platformUser.loginId',column:'login_id'},
 {id:'platformUser.name',column:'user_name',input:'name'},
 {id:'platformUser.organizationPublicId',column:'organization_public_id',input:'organizationPublicId',reference:{path:'/api/hq/admin/organizations',labelColumn:'organization_name'}},
 {id:'platformUser.active',column:'is_active',input:'active',type:'boolean'},
 {id:'platformUser.email',column:'email'},
 {id:'platformUser.erpCode',column:'erp_user_code'}
]};
export const platformOrganizationsSpec:RecordSpec={screen:'HQ_ADMIN_USERS',path:'/api/hq/admin/organizations',title:{ko:'조직 관리',en:'Organizations'},saveAction:'ADM.organizations.save',version:{field:'platformOrganization.version',column:'version',input:'expectedVersion'},fields:[
 {id:'platformOrganization.code',column:'organization_code'},
 {id:'platformOrganization.name',column:'organization_name',input:'name'},
 {id:'platformOrganization.active',column:'is_active',input:'active',type:'boolean'},
 {id:'platformOrganization.type',column:'organization_type'},
 {id:'platformOrganization.parentPublicId',column:'parent_public_id'},
 {id:'platformOrganization.erpCode',column:'erp_org_code'}
]};
