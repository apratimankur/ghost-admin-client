import ModalComponent from 'ghost-admin/components/modal-base';
import {action} from '@ember/object';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';

export default ModalComponent.extend({
    session: service(),
    store: service(),

    errorMessage: null,
    memberCount: null,

    // Allowed actions
    confirm: () => {},

    actions: {
        confirm() {
            if (this.errorMessage) {
                return this.retryEmailTask.perform();
            } else {
                if (!this.countRecipientsTask.isRunning) {
                    return this.confirmAndCheckErrorTask.perform();
                }
            }
        }
    },

    countRecipients: action(function () {
        // TODO: remove editor conditional once editors can query member counts
        if (this.model.sendEmailWhenPublished && !this.session.get('user.isEditor')) {
            this.countRecipientsTask.perform();
        }
    }),

    countRecipientsTask: task(function* () {
        const result = yield this.store.query('member', {filter: `subscribed:true+(${this.model.sendEmailWhenPublished})`, limit: 1, page: 1});
        this.set('memberCount', result.meta.pagination.total);
    }),

    confirmAndCheckErrorTask: task(function* () {
        try {
            yield this.confirm();
            this.closeModal();
            return true;
        } catch (e) {
            // switch to "failed" state if email fails
            if (e && e.name === 'EmailFailedError') {
                this.set('errorMessage', e.message);
                return;
            }

            // close modal and continue with normal error handling if it was
            // a non-email-related error
            this.closeModal();
            if (e) {
                throw e;
            }
        }
    }),

    retryEmailTask: task(function* () {
        try {
            yield this.model.retryEmailSend();
            this.closeModal();
            return true;
        } catch (e) {
            // update "failed" state if email fails again
            if (e && e.name === 'EmailFailedError') {
                this.set('errorMessage', e.message);
                return;
            }

            // TODO: test a non-email failure - maybe this needs to go through
            // the notifications service
            if (e) {
                throw e;
            }
        }
    })
});
