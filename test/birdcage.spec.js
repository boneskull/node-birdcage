'use strict';

var requireSubvert = new RequireSubvert(__dirname),
  rsSubvert = requireSubvert.subvert.bind(requireSubvert),
  rsRequire = requireSubvert.require.bind(requireSubvert),
  cleanup = requireSubvert.cleanUp.bind(requireSubvert),
  Q = require('q');

describe('birdcage', function () {

  var birdcage,
    pkg = {
      name: 'foo'
    },
    stub_Pkg,
    stub_Pkg_save;

  beforeEach(function () {
    fixture.beforeEach();
    stub_Pkg_save = sandbox.stub().returns(Q(pkg));
    stub_Pkg = sandbox.stub().returns({
      save: stub_Pkg_save
    });
    rsSubvert('lib/config', sandbox.stub(require('lib/config')));
    rsSubvert('lib/logger', sandbox.stub(require('lib/logger')));
    rsSubvert('lib/pkg', stub_Pkg);

    birdcage = rsRequire('lib/birdcage');
  });

  afterEach(function () {
    cleanup();
    fixture.afterEach();
  });

  describe('capture', function () {

    it('should throw if nothing passed', function () {
      expect(birdcage.capture).to.throw();
    });

    it('should call Pkg.prototype.save() if given a package name',
      function () {
        return expect(birdcage.capture('foo')).to.eventually.deep.equal(pkg)
          .then(function () {
            expect(stub_Pkg).to.have.been.calledWithNew;
            expect(stub_Pkg).to.have.been.calledOnce;
            expect(stub_Pkg).to.have.been.calledWith({name: 'foo'});
            expect(stub_Pkg_save).to.have.been.calledOnce;
          });

      });

    it('should call Pkg.prototype.save() if given a package name and version',
      function () {
        return expect(birdcage.capture('foo',
          '1.0.0')).to.eventually.deep.equal(pkg)
          .then(function () {
            expect(stub_Pkg).to.have.been.calledWithNew;
            expect(stub_Pkg).to.have.been.calledOnce;
            expect(stub_Pkg).to.have.been.calledWith({name: 'foo', version: '1.0.0'});
            expect(stub_Pkg_save).to.have.been.calledOnce;
          });
      });

    it('should call Pkg.prototype.save() if given a package object',
      function () {
        return expect(birdcage.capture({name: 'foo'})).to.eventually.deep.equal(pkg)
          .then(function () {
            expect(stub_Pkg).to.have.been.calledWithNew;
            expect(stub_Pkg).to.have.been.calledOnce;
            expect(stub_Pkg).to.have.been.calledWith({name: 'foo'});
            expect(stub_Pkg_save).to.have.been.calledOnce;
          });
      });

    it('should throw if Pkg.prototype.save() given an object with no name',
      function () {
        expect(birdcage.capture.bind(null, {})).to.throw();
        expect(birdcage.capture.bind(null, {}, '1.0.0')).to.throw();
      });

    it('should call Pkg.prototype.save() if given a package object and a version',
      function () {
        return expect(birdcage.capture({name: 'foo'},
          '1.0.0')).to.eventually.deep.equal(pkg)
          .then(function () {
            expect(stub_Pkg).to.have.been.calledWithNew;
            expect(stub_Pkg).to.have.been.calledOnce;
            expect(stub_Pkg).to.have.been.calledWith({name: 'foo', version: '1.0.0'});
            expect(stub_Pkg_save).to.have.been.calledOnce;
          });
      });

    it('should call Pkg.prototype.save() n times for array with length n',
      function () {
        var pkgs = ['foo', 'bar', 'baz'];
        return expect(birdcage.capture(pkgs)).to.eventually.deep.equal([pkg, pkg, pkg])
          .then(function () {
            expect(stub_Pkg).to.have.been.calledWithNew;
            expect(stub_Pkg).to.have.callCount(pkgs.length);
            pkgs.forEach(function(pkg) {
              expect(stub_Pkg).to.have.been.calledWith({name: pkg});
            });
            expect(stub_Pkg_save).to.have.been.calledThrice;
          });

      });

  });

});
