var query = require('./query'),
    cache = require('./cache'),
    util  = require('./util');

const DEBUG = false;

module.exports = function(req, res, next, ctx){
    function process_results(tsdata, qdata){
        let r = {result: []};
        if (tsdata && tsdata.rows && tsdata.rows.length > 0 && qdata && Array.isArray(qdata.rows)){
            let wrs_with_time = {},
                warranty_wrs = {};
            tsdata.rows.forEach(row => {
                // This duplicates logic in get_sla_hours.js for pretty lame reasons. (It's 3am.)
                if (row.tag === 'Warranty'){
                    warranty_wrs[row.request_id] = true;
                    delete wrs_with_time[row.request_id];
                }else if (!warranty_wrs[row.request_id]){
                    wrs_with_time[row.request_id] = row;
                }
            });
            qdata.rows.forEach(row => {
                util.log_debug(__filename, 'delete wrs_with_time[' + row.request_id + ']');
                delete wrs_with_time[row.request_id];
            });
            r.result = Object.keys(wrs_with_time).sort().map(key => {
                let row = wrs_with_time[key];
                return [{
                    wr: row.request_id + ': ' + row.brief,
                    result: util.calculate_timesheet_hours(row.hours, row.invoice_to, ctx)
                }];
            });
        }else{
            r.result.push({wr: "None", result: 0});
        }
        res.json(r);
        next && next(false);
    }

    cache.wait(cache.key('sla_hours', ctx))
        .then((tsdata) => {
            cache.wait(cache.key('approved_quotes', ctx))
                .then((qdata) => { process_results(tsdata, qdata) })
                .timeout(() => { query.error(res, next)(new Error('sla_unquoted: quote cache timed out')); })
                .limit(20);
        })
        .timeout(() => { query.error(res, next)(new Error('sla_unquoted: timesheet cache timed out')); })
        .limit(20);
}


