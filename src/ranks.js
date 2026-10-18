export const THRESHOLDS = [0,100,300,700,1400,2500,4000,6000];
export function tierFor(xp) { return THRESHOLDS.reduce((tier,threshold,i)=>xp>=threshold?i:tier,0); }
