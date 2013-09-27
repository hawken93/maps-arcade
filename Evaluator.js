var exec = require('child_process').exec;
var path = require('path');

var TIMEOUT = 5 * 1000;

function Evaluator(root) {
    this.root = root;
    this.setup();
}

module.exports = Evaluator;

Evaluator.prototype.setup = function () {
    exec('mkdir ' + this.getPath('stage'));
    exec('mkdir ' + this.getPath('bin'));
};

Evaluator.prototype.teardown = function () {
    exec('rm -rf ' + this.getPath('stage'));
    exec('rm -rf ' + this.getPath('bin'));
};

Evaluator.prototype.clean = function () {
    exec('rm -f ' + this.getPath('stage/*'));
    exec('rm -f ' + this.getPath('bin/*'));
};

Evaluator.prototype.evaluateJava = function (codeBody, statusCallback, callback) {
    this.evaluate(codeBody, this.buildJava, this.testJava, statusCallback, callback);
};

Evaluator.prototype.evaluatePython = function (codeBody, statusCallback, callback) {
    this.evaluate(codeBody, this.buildPython, this.testPython, statusCallback, callback);
};

Evaluator.prototype.evaluateC = function (codeBody, statusCallback, callback) {
    this.evaluate(codeBody, this.buildC, this.testC, statusCallback, callback);
};

Evaluator.prototype.evaluate = function (codeBody, build, test, statusCallback, callback) {
    statusCallback('Compiling...');
    var self = this;

    build.apply(this, [codeBody, function (error) {
        if (error) {
            callback(false, error);
        } else {
            statusCallback('Testing...');
            test.apply(self, [statusCallback, function (accepted, message, runningTime) {
                self.clean();
                callback(accepted, message, runningTime);
            }]);
        }
    }]);
};


Evaluator.prototype.buildJava = function (codeBody, callback) {
    var sourcePath = this.getPath('stage/Solver.java');
    var headPath = this.getPath('java/head');
    var tailPath = this.getPath('java/tail');
    var logPath = this.getPath('compilation.log');
    var binPath = this.getPath('bin');

    var compile = function (error) {
        if (error) {
            callback('Compilation failed');
            return;
        }

        exec('javac ' + sourcePath + ' -d ' + binPath, function (error, stdout, stderr) {
            exec('echo "' + stdout.toString() + '" >> ' + logPath);
            exec('echo "' + stderr.toString() + '" >> ' + logPath);

            if (error) {
                callback('Compilation failed');
                return;
            }

            callback();
        });
    };

    var addTail = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('cat ' + tailPath + ' >> ' + sourcePath, compile);
    };

    var addBody = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('echo "' + codeBody + '" >> ' + sourcePath, addTail);
    };

    var addHead = function (error) {
        exec('cat ' + headPath + ' >> ' + sourcePath, addBody);
    };

    exec('rm ' + sourcePath, addHead);
};

Evaluator.prototype.buildPython = function (codeBody, callback) {
    var headPath = this.getPath('python/head');
    var tailPath = this.getPath('python/tail');
    var binPath = this.getPath('bin/solver.py');

    var addTail = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('cat ' + tailPath + ' >> ' + binPath, function (error) {
            if (error) {
                callback('Assembly failed');
                return;
            }

            callback();
        });
    };

    var addBody = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('echo "' + codeBody + '" >> ' + binPath, addTail);
    };

    var addHead = function (error) {
        exec('cat ' + headPath + ' >> ' + binPath, addBody);
    };

    exec('rm ' + binPath, addHead);
};

Evaluator.prototype.buildC = function (codeBody, callback) {
    var sourcePath = this.getPath('stage/solver.c');
    var headPath = this.getPath('c/head');
    var tailPath = this.getPath('c/tail');
    var logPath = this.getPath('compilation.log');
    var binPath = this.getPath('bin/solver');

    var compile = function (error) {
        if (error) {
            callback('Compilation failed');
            return;
        }

        console.log('gcc -std=gnu99 -O2 ' + sourcePath + ' -o ' + binPath + ' -lrt');
        exec('gcc -std=gnu99 -O2 ' + sourcePath + ' -o ' + binPath + ' -lrt', function (error, stdout, stderr) {
            exec('echo "' + stdout.toString() + '" >> ' + logPath);
            exec('echo "' + stderr.toString() + '" >> ' + logPath);

            if (error) {
                callback('Compilation failed');
                return;
            }

            callback();
        });
    };

    var addTail = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('cat ' + tailPath + ' >> ' + sourcePath, compile);
    };

    var addBody = function (error) {
        if (error) {
            callback('Assembly failed');
            return;
        }

        exec('echo "' + codeBody + '" >> ' + sourcePath, addTail);
    };

    var addHead = function (error) {
        exec('cat ' + headPath + ' >> ' + sourcePath, addBody);
    };

    exec('rm ' + sourcePath, addHead);
};

Evaluator.prototype.testJava = function (statusCallback, callback) {
    var classPath = this.getPath('bin');
    this.test('java -cp "' + classPath + '" Solver', statusCallback, callback);
};

Evaluator.prototype.testPython = function (statusCallback, callback) {
    var binPath = this.getPath('bin/solver.py');
    this.test('python ' + binPath, statusCallback, callback);
};

Evaluator.prototype.testC = function (statusCallback, callback) {
    var binPath = this.getPath('bin/solver');
    this.test(binPath, statusCallback, callback);
};

Evaluator.prototype.test = function (command, statusCallback, callback) {
    var numTests = 8;
    var numCorrect = 0;
    var totalRunningTime = 0;
    var failed = false;

    for (var testID = 1; testID <= numTests && !failed; ++testID) {
        this.executeTest(testID, command, function (accepted, message, runningTime) {
            if (failed) {
                return;
            }

            if (accepted) {
                ++numCorrect;
                totalRunningTime += runningTime;

                statusCallback('Passed test ' + numCorrect + '/' + numTests);

                if (numCorrect == numTests) {
                    callback(true, 'Accepted', totalRunningTime);
                }
            } else {
                failed = true;
                callback(false, message);
            }
        });
    }
};

Evaluator.prototype.executeTest = function (testID, command, callback) {
    var inputPath = this.getPath('testdata/test' + testID + '.in');
    var answerPath = this.getPath('testdata/test' + testID + '.ans');

    exec(command + ' < ' + inputPath, {timeout:TIMEOUT}, function (error, stdout, stderr) {
        if (error) {
            if (error.signal == 'SIGTERM') {
                callback(false, 'Timelimit exceeded');
            } else {
                callback(false, 'Runtime error');
            }
        } else {
            var result = stdout.toString();
            var runningTime = Number(stderr.toString());

            exec('(echo ' + stdout.toString() + ') | diff ' + answerPath + ' -', function (error, stdout, stderr) {
                if (error) {
                    if (error.signal == 'SIGTERM') {
                        callback(false, 'Timelimit exceeded');
                    } else {
                        callback(false, 'Wrong answer');
                    }
                    return;
                }

                callback(true, 'Accepted', runningTime);
            });
        }

    });
};

Evaluator.prototype.getPath = function (relativePath) {
    return path.resolve(this.root, relativePath);
};
