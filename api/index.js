var config  = require('config'),
    cache   = require('wrms-dash-db').cache,
    db      = require('wrms-dash-db').db.create(),
    get_dash_context = require('./lib/context'),
    util    = require('wrms-dash-util'),
    qf      = require('./lib/quote_funcs'),
    query   = require('wrms-dash-db').query,
    restify = require('restify');

'use strict';

const GENERIC_ERROR = {error: 'Service interruption - please try again later'};

var server = restify.createServer({
    name: 'wrms-dash-api',
    versions: [config.get('server.version')]
});

server.use(function _cors(req, res, next){
    res.setHeader('Access-Control-Allow-Origin', '*');
    let m = req.headers['access-control-request-method'];
    if (m)  res.setHeader('Access-Control-Allow-Methods', m);
    let h = req.headers['access-control-request-headers'];
    if (h)  res.setHeader('Access-Control-Allow-Headers', h);
    return next();
});

server.use(restify.bodyParser({mapParams: true}));
server.use(restify.queryParser({mapParams: true}));

server.on('uncaughtException', (req, res, route, err) => {
    util.log(__filename, err.stack);
    res.send(500, GENERIC_ERROR);
});

function preflight(req, res, next){
    res.send(200);
    return next();
}

function setup(method, func, handler){
    let path = ':org/:sys/:period';

    server.opts('/api' + func + '/' + path, preflight);

    server[method]('/api' + func + '/' + path, function(req, res, next){
        let ctx = get_dash_context(req);

        if (ctx.error){
            util.log(__filename, 'get_dash_context: ' + ctx.error);
            res.json({error: ctx.error});
            return;
        }

        handler(req, res, next, ctx);
    });
}

var store = require('./lib/data_store');

const ALLOW_INSECURE_TESTING_FUNCTIONS = false;

server.post('/sql', function(req, res, next){
    if (ALLOW_INSECURE_TESTING_FUNCTIONS == false){
        res.send({ error: 'Not allowed.' });
        next && next(false);
        return;
    }

    let json = undefined;
    try{ json = JSON.parse(req.body); }
    catch(ex){ util.log(__filename, ex); }

    function dump_rows_as_csv(rows){
        if (Array.isArray(rows) && rows.length > 0){
            console.log(Object.keys(rows[0]).join(','));
            rows.forEach(row => {
                console.log(Object.values(row).join(','));
            });
        }
    }
    if (json.sql){
        store.query(json.sql, (err, rows) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.send({ error: err });
            }else{
                dump_rows_as_csv(rows);
                res.send({ rows });
            }
            next && next(false);
        });
    }else{
        res.send({ error: 'Expected object {sql:""} missing' });
        next && next(false);
    }
});

server.post('/enc', function(req, res, next){
    res.send(util.crypt.encrypt(req.body));
    next && next(false);
});

server.post('/dec', function(req, res, next){
    res.send(util.crypt.decrypt(req.body));
    next && next(false);
});

var get_quotes = require('./lib/get_quotes');

setup('get', '/pending_quotes',     get_quotes({sla:undefined,  approved:false, limit_period:false}));
setup('get', '/sla_quotes',         get_quotes({sla:true,       approved:true,  limit_period:true }));
setup('get', '/additional_quotes',  get_quotes({sla:false,      approved:true,  limit_period:true }));

setup('get', '/mis_report', require('./lib/get_mis_report'));

setup('get', '/invoices', require('./lib/get_odoo_invoices'));

setup('get', '/sla_unquoted', require('./lib/get_sla_unquoted'));

setup('get', '/new_sysadmin_wrs', require('./lib/get_new_sysadmin_wrs'));

setup('get', '/wrs_to_invoice', require('./lib/get_wrs_to_invoice'));

setup('get', '/additional_wrs_unquoted', require('./lib/get_additional_wrs_unquoted'));

//setup('get', '/combined_budgets', require('./lib/get_combined_budgets'));

setup('get', '/customer_list', require('./lib/get_customer_list'));

setup('get', '/customer', require('./lib/get_customer'));

setup('get', '/wrs_created_count', require('./lib/get_wrs_created_count'));

setup('get', '/wrs_over_time', require('./lib/get_wrs_over_time'));

setup('get', '/deployments', require('./lib/get_deployments'));

setup('get', '/users', require('./lib/get_users'));

setup('get', '/storage', require('./lib/get_storage'));

setup('get', '/availability', require('./lib/get_availability'));

setup('get', '/fte_budgets', require('./lib/get_fte_budgets'));

setup('get', '/raw_timesheets', require('./lib/get_raw_timesheets'));

setup(
    'get',
    '/response_times_PLACEHOLDER',
    query.prepare('response_times', 'rtt',
        function(ctx){
            return 'select 1';
        },
        function(data, ctx, next){
            next({result: []});
        }
    )
);

setup('get', '/response_times', require('./lib/get_response_times'));

setup('get', '/sla_hours', require('./lib/get_sla_hours'));

var wr_list_query = require('./lib/get_wr_list');

setup(
    'get',
    '/wr_list',
    wr_list_query({
        exclude_statuses: [],
        limit_period: true
    })
);

setup(
    'get',
    '/statuses',
    wr_list_query({
        limit_period: false,
        processor: (rows) => {
            let o = {};

            rows.forEach(r => {
                let x = o[r.status] || 0;
                ++x;
                o[r.status] = x;
            });

            let r = [];
            Object.keys(o).sort().forEach(status => { r.push([status, o[status]]) });
            return r;
        }
    })
);

setup(
    'get',
    '/severity',
    wr_list_query({
        limit_period: false,
        processor: (rows) => {
            let r = [
                [ 'Low', 0 ],
                [ 'Medium', 0 ],
                [ 'High', 0 ],
                [ 'Critical', 0 ]
            ];
            rows.forEach(row => {
                r[util.map_severity(row.urgency, row.importance).number][1]++;
            });
            return r;
        }
    })
);

function main(port){
    server.listen(port, function(err){
        if (err){
            throw err;
        }
        util.log(__filename, `${server.name} listening at ${server.url}`);
    });
    require('./lib/data_sync').unpause();
}

if (require.main === module){
    main(config.get('server.listen_port'));
}

exports.run = main;
