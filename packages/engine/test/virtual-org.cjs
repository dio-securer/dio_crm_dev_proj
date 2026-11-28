// A synthetic domestic sales organisation (company -1, never a real row): domestic sales > region > division > branch.
// Each level has a head; salespeople sit under branches. Keys only; display names belong in metadata terms.
const COMPANY_ID = -1;
const units = [
  { id: 'dom', headUserId: 'h-dom', erpOrgCode: 'V-DOM' },
  { id: 'reg-cap', parentId: 'dom', headUserId: 'h-reg-cap', erpOrgCode: 'V-REG-CAP' },
  { id: 'reg-south', parentId: 'dom', headUserId: 'h-reg-south', erpOrgCode: 'V-REG-SOUTH' },
  { id: 'div-cap-1', parentId: 'reg-cap', headUserId: 'h-div-cap-1', erpOrgCode: 'V-DIV-CAP-1' },
  { id: 'br-cap-1a', parentId: 'div-cap-1', headUserId: 'h-br-cap-1a', erpOrgCode: 'V-BR-CAP-1A' },
  { id: 'br-cap-1b', parentId: 'div-cap-1', headUserId: 'h-br-cap-1b', erpOrgCode: 'V-BR-CAP-1B' },
  { id: 'div-south-1', parentId: 'reg-south', headUserId: 'h-div-south-1', erpOrgCode: 'V-DIV-SOUTH-1' },
  { id: 'br-south-1a', parentId: 'div-south-1', headUserId: 'h-br-south-1a', erpOrgCode: 'V-BR-SOUTH-1A' },
];
const members = [
  { userId: 's-1a-1', unitId: 'br-cap-1a' }, { userId: 's-1a-2', unitId: 'br-cap-1a' },
  { userId: 's-1b-1', unitId: 'br-cap-1b' }, { userId: 's-south-1', unitId: 'br-south-1a' },
];
const chart = { units, members };
const owners = ['s-1a-1', 's-1a-2', 's-1b-1', 's-south-1', 'h-br-cap-1a', 'h-div-cap-1', 'h-reg-cap', 'h-dom'];
const rows = owners.map((owner, i) => ({ id: String(i + 1), owner_name: owner, company_id: COMPANY_ID }));
module.exports = { COMPANY_ID, chart, rows };
