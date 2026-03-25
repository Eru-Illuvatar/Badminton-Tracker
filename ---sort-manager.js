// ============================================
// sort-manager.js
// ============================================

import { parseUniversalDate } from './utils.js';

export function sortData(data, field = 'date', direction = 'desc') {
    if (!data || data.length === 0) return [];
    
    const sorted = [...data];
    
    sorted.sort((a, b) => {
        let aValue, bValue;
        
        switch(field) {
            case 'date':
                aValue = parseUniversalDate(a.Datum);
                bValue = parseUniversalDate(b.Datum);
                break;
                
            case 'type':
                aValue = (a.Fase || '').toLowerCase();
                bValue = (b.Fase || '').toLowerCase();
                break;
                
            case 'result':
                aValue = a.isWin ? 1 : 0;
                bValue = b.isWin ? 1 : 0;
                break;
                
            default:
                aValue = parseUniversalDate(a.Datum);
                bValue = parseUniversalDate(b.Datum);
        }
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return direction === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
}

export function getCurrentSort() {
    return {
        field: 'date',
        direction: 'desc'
    };
}