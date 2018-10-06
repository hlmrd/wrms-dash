var util = require('wrms-dash-util'),
    config = require('config'),
    Swapper = require('./swapper');

'use strict';

const DEBUG = false;

function OrgData(){
    this.data = {};
}

OrgData.prototype.wipe = function(){
    this.data = {};
}

OrgData.prototype.add_org = function(contract){
    util.log_debug(__filename, `add_org(${JSON.stringify(contract)})`, DEBUG);

    this.data[contract.name] = JSON.parse(JSON.stringify(contract));
}

OrgData.prototype.add_system = function(contract, system){
    util.log_debug(__filename, `add_system(${JSON.stringify(contract)}, ${system})`, DEBUG);

    let o = this.data[contract.name];

    if (o){
        let s = o.systems || [];
        if (!s.includes(system)){
            s.push(system);
        }
        o.systems = s;
    }else{
        throw new Error(`add_system(${system}) called before add_org(${contract.name})`);
    }
}

// Succeed if either argument is null, or if the arrays match exactly.
function systems_match(a, b){
    return !Array.isArray(a) ||
           !Array.isArray(b) ||
           a.sort().join(',') === b.sort().join(',');
}

OrgData.prototype.get_org_by_key = function(field, val, systems){
    let o = null;

    Object.values(this.data).forEach(org => {
        if (org[field] === val && systems_match(systems, org.systems)){
            o = org;
        }
    });

    return o;
}

// Input is either a context object or a bare value, where the values are one of
//  - contracts.org_id
//  - contracts.name
// and it may be either a bare value or part of a context object (i.e. id vs. id.org)
//
// Systems may be provided to disambiguate orgs with multiple contracts
//
// Returns contracts.* or null
OrgData.prototype.get_org = function(id, systems){
    if (id === undefined){
        throw new Error('get_org() with no ID specified');
    }

    let o = null,
        n = parseInt(id); // in case it's a bare number

    if (id.org || !isNaN(n)){
        // Numeric lookups may need to be disambiguated by system
        if (id.org){
            o = this.get_org_by_key('org_id', id.org, id.systems);
        }else{
            o = this.get_org_by_key('org_id', n, systems);
        }
    }else{
        // Name lookups are already unique... Unless someone has messed up in the CRM,
        // in which case we'll just return the first match
        o = this.get_org_by_key('name', id);
    }

    // This happens on startup when we haven't synced yet.
    if (!o && id === '__vendor'){
        o = config.get('contracts').filter(c => { return c.name === '__vendor' })[0];
    }

    util.log_debug(__filename, 'get_org(' + JSON.stringify({id:id}) + ') => ' + JSON.stringify(o), DEBUG);

    return o;
}

OrgData.prototype.each = function(fn){
    Object.values(this.data).forEach(fn);
}

OrgData.prototype.get_all_orgs = function(even_those_without_systems){
    return Object.values(this.data)
                .filter(o => {
                    let has_systems = o.systems.length > 0;
                    return o.org_name !== '__vendor' && (has_systems || even_those_without_systems);
                })
                .map(o => {
                    return o.org_id
                });
}

module.exports = new Swapper(new OrgData(), new OrgData());

