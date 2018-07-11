var request = require('request'),
    config = require('config'),
    util = require('./util');

var auth_username = undefined,
    auth_token = undefined;

const DEBUG = false;

exports.fetch_contracts = function(){
    return new Promise((resolve, reject) => {
        log_in().then(query_espo_contracts)
                .then(query_espo_accounts)
                .then(merge_espo_data)
                .then(
                    resolve,
                    reject
                );
    });
}

// returns {"user":{"id":"5900af1c7206dafeb","userName":"jacques","isActive":true,"token":"0d5bceacb976ec7d6c89d4e7f8ce4100",...
function log_in(){
    return new Promise((resolve, reject) => {
        let auth = config.get('espo.auth'),
            options = {
                url: config.get('espo.host') + '/espo/api/v1/App/user',
                strictSSL: false,
                headers: {
                    'Espo-Authorization': auth,
                    'Espo-Authorization-By-Token': 'false',
                    'Authorization': 'Basic ' + auth,
                    'Accept': 'application/json'
                }
            };

        util.log_debug(__filename, `log_in(): curl -sik '${options.url}' -H 'Espo-Authorization: ${auth}' -H 'Espo-Authorization-By-Token: false' -H 'Authorization: Basic ${auth}' -H 'Accept: application/json'`, DEBUG);

        request(
            options,
            (err, res, body) => {
                if (err){
                    reject(err);
                    return;
                }
                if (res.statusCode >= 400){
                    let reason = res.headers['x-status-reason'] || 'unknown';
                    reject(new Error(`CRM login (${res.statusCode} reason ${reason})`));
                }
                if (res.statusCode == 200){
                    let json = null;
                    try{
                        json = JSON.parse(body);
                    }catch(ex){
                        reject(ex);
                    }
                    auth_username = json.user.userName;
                    auth_token = json.user.token;
                    resolve({username: json.user.userName, token: json.user.token});
                }
            }
        );
    });
}

// returns {
//   list: [
//     {
//       accountName: "University Of Bath",
//       name: "2018 SLA",
//       accountId: "58e4fc5d455da125a",
//       startDate: "2018-06-17",
//       endrenewalDate: "2020-06-16",
//       invoicingFrequency: "Monthly",
//       sLAFrequency: "Monthly ",
//       sLAHours: 30,
//       systemID: null,
//       status: "Active",
//       type: "Service Level Agreement",
//       ...
//     }
//   ]
// }
function query_espo_contracts(context){
    return new Promise((resolve, reject) => {
        let token = new Buffer(context.username + ':' + context.token).toString('base64');
            // TODO: increase offset until list.size is 0
            options = {
                url: config.get('espo.host') + '/espo/api/v1/Case?maxSize=200&offset=0&sortBy=type&asc=false',
                strictSSL: false,
                headers: {
                    'Espo-Authorization': token,
                    'Espo-Authorization-By-Token': 'true',
                    'Authorization': 'Basic ' + token,
                    'Accept': 'application/json',
                    'Cookie': 'auth-username=' + context.username + '; auth-token=' + context.token
                }
            };

        util.log_debug(__filename, `query_espo_conracts(): curl -sik '${options.url}' -H 'Espo-Authorization: ${token}' -H 'Espo-Authorization-By-Token: true' -H 'Authorization: Basic ${token}' -H 'Accept: application/json' -H 'Cookie: auth-username=${context.username}; auth-token=${context.token}'`, DEBUG);

        request(
            options,
            (err, res, body) => {
                if (err){
                    reject(err);
                    return;
                }
                if (res.statusCode >= 400){
                    let reason = res.headers['x-status-reason'] || 'unknown';
                    reject(new Error(`CRM contract query (${res.statusCode} reason ${reason})`));
                }
                if (res.statusCode == 200){
                    try{
                        context.contracts = JSON.parse(body);
                    }catch(ex){
                        reject(ex);
                    }
                    resolve(context);
                }
            }
        );
    });
}

// returns {
//   list: [
//     {
//       id: "58e4fc5d455da125a",
//       orgID: 1757,
//       ...
//     }
//   ]
// }
function query_espo_accounts(context){
    return new Promise((resolve, reject) => {
        let token = new Buffer(auth_username + ':' + auth_token).toString('base64'),
            // TODO: increase offset until list.size is 0
            options = {
// curl 'https://crm.catalyst-eu.net/espo/api/v1/Account?maxSize=50&offset=0&sortBy=createdAt&asc=false' -H 'Espo-Authorization: amFjcXVlczo0NmVmMTg4ZTk5YmRiMzVmYTYzNjkyZTYxNGQ0MGFjMQ==' -H 'DNT: 1' -H 'Espo-Authorization-By-Token: true' -H 'Accept-Encoding: gzip, deflate, br' -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' -H 'Authorization: Basic amFjcXVlczo0NmVmMTg4ZTk5YmRiMzVmYTYzNjkyZTYxNGQ0MGFjMQ==' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.119 Safari/537.36' -H 'Accept: application/json, text/javascript, */*; q=0.01' -H 'Referer: https://crm.catalyst-eu.net/espo/' -H 'X-Requested-With: XMLHttpRequest' -H 'Cookie: auth-username=jacques; auth-token=46ef188e99bdb35fa63692e614d40ac1' -H 'Connection: keep-alive' --compressed
                url: config.get('espo.host') + '/espo/api/v1/Account?maxSize=200&offset=0&sortBy=createdAt&asc=false',
                strictSSL: false,
                headers: {
                    'Espo-Authorization': token,
                    'Espo-Authorization-By-Token': 'true',
                    'Authorization': 'Basic ' + token,
                    'Accept': 'application/json',
                    'Cookie': 'auth-username=' + auth_username + '; auth-token=' + auth_token
                }
            };

        util.log_debug(__filename, `query_espo_accounts(): curl -sik '${options.url}' -H 'Espo-Authorization: ${token}' -H 'Espo-Authorization-By-Token: true' -H 'Authorization: Basic ${token}' -H 'Accept: application/json' -H 'Cookie: auth-username=${context.username}; auth-token=${context.token}'`, DEBUG);

        request(
            options,
            (err, res, body) => {
                if (err){
                    reject(err);
                    return;
                }
                if (res.statusCode >= 400){
                    let reason = res.headers['x-status-reason'] || 'unknown';
                    reject(new Error(`CRM account query (${res.statusCode} reason ${reason})`));
                }
                if (res.statusCode == 200){
                    try{
                        context.accounts = JSON.parse(body);
                    }catch(ex){
                        reject(ex);
                    }
                    resolve(context);
                }
            }
        );
    });
}

// Link contracts and accounts based on account ID, and select only contracts with:
//      status: "Active"
//      type: "Service Level Agreement"
function merge_espo_data(context){
    let active = {};
    util.log_debug(__filename, '==================== Raw contracts: ', DEBUG);
    context.contracts.list.forEach(c => {
        util.log_debug(__filename, JSON.stringify(c), DEBUG);
        if (c.status === 'Active' && c.type === 'Service Level Agreement' && c.accountName.includes('Human')){
            active[c.accountId] = {
                name: c.name,
                org_name: c.accountName,
                type: (c.sLAFrequency || 'unknown').toLowerCase().trim(),
                hours: (c.sLAHours || 0),
                start_date: util.date_fmt(new Date(c.startDate)),
                end_date: util.date_fmt(new Date(c.endrenewalDate)),
                systems: (c.systemID ? c.systemID.split(/,\s*/).map(n => parseInt(n)).filter(n => n !== null && !isNaN(n)) : [])
            };
        }
    });
    util.log_debug(__filename, '==================== Raw accounts: ', DEBUG);
    context.accounts.list.forEach(a => {
        util.log_debug(__filename, JSON.stringify(a), DEBUG);
        if (active[a.id]){
            active[a.id].org_id = a.orgID;
        }
    });
    return Object.values(active);
}
