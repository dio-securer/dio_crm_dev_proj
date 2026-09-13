import React from 'react';

export type MapPoint = { id:string; name:string; latitude:number; longitude:number; address?:string; };
export type MapAdapterProps = { currentLocation?:{latitude:number;longitude:number}; locations:MapPoint[]; };

export type MapRenderer = React.ComponentType<MapAdapterProps>;

export function UnconfiguredMap({ locations }: MapAdapterProps) {
  return <div style={{ border:'1px solid #dfe4ea', borderRadius:12, padding:16, background:'#f8fafc' }}>
    <b>Map provider not configured</b>
    <p style={{ marginBottom:0, color:'#667085' }}>{locations.length} location(s) are available to a market-specific map adapter.</p>
  </div>;
}
