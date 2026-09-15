"use strict";(self.webpackChunkmfe_access_workflow=self.webpackChunkmfe_access_workflow||[]).push([["src_util_personalization_util_ts"],{7674(t,e,i){i.r(e),i.d(e,{getPersonalizationData:()=>u});var n=i(3592),s=i(8465);const a=n.J1`
  query SessionProviderQuery($uuid: UUID!) {
    session(uuid: $uuid) {
      providerDesignationStatements {
        institutionId
      }
      userAccount {
        id
      }
    }
  }
`;var r=i(3678);const u=async()=>{try{const t=r.default.get("UUID")||"",e=await async function(t){const e=await(0,s.A)();try{const i=await e.query({query:a,variables:{uuid:t}});return i?.data?.session||null}catch(t){return null}}(t),i=(t=>!!(t?.providerDesignationStatements&&t.providerDesignationStatements.length>0))(e);return{isInstitutionallyAuthed:i,isIndividuallyAuthed:!!e?.userAccount?.id}}catch(t){return console.error("Error fetching personalization data:",t),{isInstitutionallyAuthed:!1,isIndividuallyAuthed:!1}}}}}]);
//# sourceMappingURL=src_util_personalization_util_ts.2ae77f9572ae6761dd8f.js.map