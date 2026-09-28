const { withProjectBuildGradle } = require("@expo/config-plugins");

const SUMSUB_REPOSITORY = "https://maven.sumsub.com/repository/maven-public/";

module.exports = function withSumsub(config) {
  return withProjectBuildGradle(config, (project) => {
    if (!project.modResults.contents.includes(SUMSUB_REPOSITORY)) {
      project.modResults.contents += `\nallprojects {\n  repositories {\n    maven { url \"${SUMSUB_REPOSITORY}\" }\n  }\n}\n`;
    }

    return project;
  });
};
