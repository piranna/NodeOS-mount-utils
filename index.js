var fs = require('fs')

var spawn = require('child_process').spawn

var mkdirp = require('mkdirp').sync;
var mount  = require('nodeos-mount');


function execInit(HOME, argv, onerror)
{
  try
  {
    var homeStat = fs.statSync(HOME)
  }
  catch(error)
  {
    if(error.code != 'ENOENT') throw error

    return onerror(HOME+' not found')
  }

  const initPath = HOME+'/init'

  try
  {
    var initStat = fs.statSync(initPath)
  }
  catch(error)
  {
    if(error.code != 'ENOENT') throw error

    return onerror(initPath+' not found')
  }

  if(!initStat.isFile())
    return onerror(initPath+' is not a file');

  if(homeStat.uid != initStat.uid || homeStat.gid != initStat.gid)
    return onerror(HOME+" uid & gid don't match with its init")

  // Start user's init
  spawn(__dirname+'/bin/chrootInit', argv || [],
  {
    cwd: HOME,
    stdio: 'inherit',
    uid: homeStat.uid,
    gid: homeStat.gid
  })
  .on('error', onerror)
}

function mkdirMount(dev, path, type, flags, extras, callback)
{
  try
  {
    mkdirp(path, '0111')
  }
  catch(error)
  {
    if(error.code != 'EEXIST') throw error
  }

  mount.mount(dev, path, type, flags, extras, callback);
}

function mountfs(envDev, path, type, flags, extras, callback)
{
  if(extras instanceof Function)
  {
    callback = extras
    extras   = undefined
  }

  try
  {
    // Running on Docker?
    fs.statSync('/.dockerinit')
  }
  catch(err)
  {
    if(err.code != 'ENOENT') throw err

    var dev = process.env[envDev]
    if(dev)
      return mkdirMount(dev, path, type, flags, extras, function(error)
      {
        if(error) return callback(error)

        delete process.env[envDev]
        callback()
      });

    return callback(envDev+' filesystem not defined')
  }

  return callback()
}

function mountfs_path(devPath, path, type, flags, extras, callback)
{
  if(extras instanceof Function)
  {
    callback = extras
    extras   = undefined
  }

  try
  {
    // Running on Docker?
    fs.statSync('/.dockerinit')
  }
  catch(err)
  {
    if(err.code != 'ENOENT') throw err

    if(devPath)
      return mkdirMount(devPath, path, type, flags, extras, function(error)
      {
        if(error) return callback(error)

        callback()
      });

    return callback(devPath+' filesystem not defined')
  }

  return callback()
}

function move(source, target, callback)
{
  mount.mount(source, target, mount.MS_MOVE, function(error)
  {
    if(error) return callback(error)

    fs.readdir(source, function(error, files)
    {
      if(error) return callback(error)

      if(files.length) return callback()
      fs.rmdir(source, callback)
    })
  });
}

function moveSync(source, target)
{
  mount.mountSync(source, target, mount.MS_MOVE);

  if(!fs.readdirSync(source).length)
    fs.rmdirSync(source)
}

function startRepl(prompt)
{
  console.log('Starting REPL session')

  require('repl').start(prompt+'> ').on('exit', function()
  {
    console.log('Got "exit" event from repl!');
    process.exit(2);
  });
}


exports.flags = mount;

exports.execInit     = execInit;
exports.mkdirMount   = mkdirMount;
exports.mountfs      = mountfs;
exports.mountfs_path = mountfs_path;
exports.move         = move;
exports.moveSync     = moveSync;
exports.startRepl    = startRepl;
