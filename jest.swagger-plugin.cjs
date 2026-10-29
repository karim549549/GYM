const swaggerPlugin = require('@nestjs/swagger/plugin');

exports.name = 'nestjs-swagger-transformer';
exports.version = 1;
exports.factory = (compilerService) =>
  swaggerPlugin.before(
    {
      classValidatorShim: true,
      dtoFileNameSuffix: ['.dto.ts', '.entity.ts', '.spec.ts'],
    },
    compilerService.program,
  );
