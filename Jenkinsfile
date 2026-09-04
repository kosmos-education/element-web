#!/usr/bin/env groovy
@Library('kosmos_pipeline') _

def localBuildClosure = { defaultStep, args ->
    // Comme en plus de faire l'image docker, on va utiliser yarn publish, on utilise les credentials de Nexus.
    //
    // gitUsernamePassword s'ajoute pour defaultStep() : la librairie kosmos_pipeline y pose un tag
    // de release et le pousse (`git push origin skolengo/element-web-…`) en `sh` brut, donc sans
    // credential. GitHub bride les opérations non authentifiées (cf. ULK-1762) et le push échoue.
    // À terme, ce binding a sa place dans kosmos_pipeline plutôt qu'ici, où il profiterait à tous
    // les projets ; en attendant, il débloque celui-ci.
    withCredentials([
        usernamePassword(credentialsId: 'JENKINS_NEXUS_AUTH', usernameVariable: 'NEXUS_USER', passwordVariable: 'NEXUS_PASS'),
        gitUsernamePassword(credentialsId: 'GITHUB_BOTKOSMOS', gitToolName: 'Default'),
    ]) {
        sh "docker build -f apps/web/Dockerfile --secret id=NEXUS_USER --secret id=NEXUS_PASS ."
        defaultStep()
    }
}

// Utilisation du pipeline générique de kosmos-pipeline
pipelineDocker(
        IMAGE_NAME: 'skolengo/element-web',
        DOCKER_LABEL: 'docker',
        NOTIF_CHANNEL: 'kde-jenkins',
        DISABLE_DEPLOYMENT_STEP: true,
        CLUSTER_NAME: 'skoen',
        DOCKER_OPTIONS: '--build-arg NPM_TOKEN=${NPM_TOKEN}',
	DOCKERFILE: 'apps/web/Dockerfile',
        PRE_BUILD_CLOSURE: {
            // Les tags git ne servent QUE dans un cas : scripts/dist-version.sh termine par
            // `git describe --abbrev=0 --tags` lorsque la branche n'est pas une branche kosmos/*.
            // Sur kosmos/release/vX.Y.Z* comme sur kosmos/<xxx>, DIST_VERSION est dérivée du nom
            // de branche et aucun tag n'est lu : inutile d'aller solliciter GitHub.
            //
            // Job multibranche => BRANCH_NAME vaut exactement "kosmos/release/v1.12.22-2".
            // GIT_BRANCH (jobs classiques) sert de repli et peut être préfixé "origin/".
            String branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')

            if (branch.startsWith('kosmos/')) {
                echo "Branche « ${branch} » : DIST_VERSION dérive du nom de branche " +
                     "(cf. scripts/dist-version.sh) → pas de fetch des tags ni d'unshallow."
                return
            }

            // Branche indéterminée ou hors kosmos/* : on récupère l'historique et les tags.
            // Repli volontairement prudent — au pire un fetch superflu, jamais un build develop cassé.
            echo "Branche « ${branch ?: 'indéterminée'} » : DIST_VERSION vient de " +
                 "git describe --tags → récupération de l'historique et des tags."

            // GitHub bride les opérations non authentifiées, même sur un dépôt public (cf. ULK-1762).
            // Le binding GIT_ASKPASS du checkout SCM ne survit pas à l'étape : un `git fetch` nu
            // repart sans credential et échoue (exit 128, « could not read Username »).
            // gitUsernamePassword installe un credential helper temporaire, purgé en sortie du
            // bloc — rien n'est écrit dans l'URL du remote ni dans .git/config.
            withCredentials([gitUsernamePassword(credentialsId: 'GITHUB_BOTKOSMOS', gitToolName: 'Default')]) {
                sh(label: 'Fetch des tags (authentifié)', script: '''
                    set -e
                    # Pas de TTY sur l'agent k8s : échouer vite plutôt qu'attendre une saisie.
                    export GIT_TERMINAL_PROMPT=0

                    # `git fetch --unshallow` échoue si le dépôt est déjà complet : garder la garde.
                    if git rev-parse --is-shallow-repository 2>/dev/null | grep -q "true"; then
                        echo "Dépôt shallow détecté → unshallow + tags"
                        git fetch --unshallow --tags --force
                    else
                        echo "Dépôt déjà complet → fetch des tags uniquement"
                        git fetch --tags --force
                    fi

                    echo "Derniers tags disponibles :"
                    git tag -l | tail -n 5
                '''
                )
            }
        },
        BUILD_STEP_CLOSURE: localBuildClosure
)
