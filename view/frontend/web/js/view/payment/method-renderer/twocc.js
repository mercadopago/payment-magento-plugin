/* eslint-disable max-len */
/**
 * Copyright © MercadoPago. All rights reserved.
 *
 * @license     See LICENSE for license details.
 */

define([
    'underscore',
    'jquery',
    'Magento_Checkout/js/model/full-screen-loader',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/model/totals',
    'Magento_Checkout/js/model/url-builder',
    'MercadoPago_PaymentMagento/js/view/payment/mp-security-form',
    'Magento_Vault/js/view/payment/vault-enabler',
    'mage/url',
    'MercadoPago_PaymentMagento/js/model/mp-card-data',
    'MercadoPago_PaymentMagento/js/action/checkout/set-finance-cost',
    'Magento_Ui/js/model/messageList',
    'mage/translate',
    'Magento_Catalog/js/price-utils'
], function (
    _,
    $,
    fullScreenLoader,
    quote,
    totals,
    urlBuilder,
    Component,
    VaultEnabler,
    urlFormatter,
    mpCardData,
    setFinanceCost,
    messageList,
    $t,
    priceUtils
 ) {
    'use strict';
    return Component.extend({

        totals: quote.getTotals(),

        defaults: {
            active: false,
            template: 'MercadoPago_PaymentMagento/payment/twocc',
            twoCcForm: 'MercadoPago_PaymentMagento/payment/twocc-form',
            securityField: 'MercadoPago_PaymentMagento/payment/security-field',
            amount:  quote.totals().base_grand_total,
            installmentTextInfo: false,
            installmentTextTEA: null,
            installmentTextCFT: null,
            isLoading: true,
            inputValueProgress:''
        },

        /**
         * Get code
         * @returns {String}
         */
        getCode() {
            return 'mercadopago_paymentmagento_twocc';
        },

        /**
         * Initializes model instance observable.
         *
         * @returns {Object}
         */
        initObservable() {
            this._super().observe([
                'active',
                'amount',
                'isLoading',
                'installmentTextInfo',
                'installmentTextTEA',
                'installmentTextCFT',
                'inputValueProgress'
            ]);
            return this;
        },

        /**
         * Init component
         */
        initialize() {
            let self = this;

            this._super();

            this.vaultEnabler = new VaultEnabler();

            this.vaultEnabler.setPaymentCode(this.getVaultCode());

            if (quote.billingAddress()) {
                self.mpPayerDocument(quote.billingAddress().vatId);
            }

            self.active.subscribe((value) => {
                if (value === true) {
                    self.getSelectDocumentTypes();
                    self.getListOptionsToInstallments();
                    mpCardData.mpCardInstallment =  null;

                    setTimeout(() => {
                        self.mountCardForm();
                        self.isLoading(false);
                    }, 3000);
                }

                if (value === false) {
                    mpCardData.mpCardInstallment =  null;
                    self.mpCardInstallment(null);
                    self.unMountCardForm();
                    self.isLoading(true);
                }
            });

            quote.totals.subscribe((value) => {
                var financeCostAmount = 0;

                if (this.totals() && totals.getSegment('finance_cost_amount')) {
                    financeCostAmount = totals.getSegment('finance_cost_amount').value;
                }

                self.amount(value.base_grand_total - financeCostAmount);
            });

            self.amount.subscribe((value) => {
                mpCardData.amount = value;
                self.getListOptionsToInstallments();
            });

            self.inputValueProgress.subscribe((value) => {
                self.updateProgress(value);
            });
        },

        /**
         * Add Finance Cost in totals
         * @returns {void}
         */
        addFinanceCost() {
            var self = this,
                selectInstallment = self.mpCardInstallment(),
                rulesForFinanceCost = self.mpCardListInstallments();

            if (self.getMpSiteId() === 'MLA') {
                _.map(rulesForFinanceCost, (keys) => {
                    if (keys.installments === selectInstallment) {
                        self.addTextForInstallment(keys.labels);
                    }
                });
            }

            setFinanceCost.financeCost(selectInstallment, rulesForFinanceCost);
        },

        /**
         * Is Active
         * @returns {Boolean}
         */
        isActive() {
            var self = this,
                active = self.getCode() === self.isChecked();

            self.active(active);

            return active;
        },

        /**
         * Init Form Element
         * @returns {void}
         */
        initFormElement(element) {
            this.formElement = element;
            $(this.formElement).validation();
        },

        /**
         * Before Place Order
         * @returns {void}
         */
        beforePlaceOrder() {
            if (!$(this.formElement).valid()) {
                return;
            }
            this.getTokenize();
        },

        /**
         * Type Debit
         */

        /**
         * Get Tokenize
         * @returns {void}
         */
        getTokenize() {
            var self = this,
                cardHolderName = self.mpCardHolderName(),
                documentIdenfitication = self.mpPayerDocument(),
                documentType = self.mpPayerType(),
                isUsed = this.vaultEnabler.isVaultEnabled(),
                saveCard = this.vaultEnabler.isActivePaymentTokenEnabler(),
                quoteId = quote.getQuoteId(),
                unsupportedPreAuth = self.getUnsupportedPreAuth(),
                mpSiteId = self.getMpSiteId(),
                payload,
                payloadCreateVault,
                serviceUrl,
                formatNumber;

            if (unsupportedPreAuth[mpSiteId].includes(self.mpCardType())) {
                isUsed = false;
                saveCard = false;
            }

            if (documentIdenfitication) {
                documentIdenfitication = documentIdenfitication.replace(/\D/g, '');
            }

            fullScreenLoader.startLoader();

            payload = {
                cardholderName: cardHolderName,
                identificationType: documentType,
                identificationNumber: documentIdenfitication
            };

            if (saveCard && isUsed) {

                window.mp.fields.createCardToken(payload).then((token) => {
                    formatNumber = token.first_six_digits + 'xxxxxx' + token.last_four_digits;
                    self.mpCardNumberToken(token.id);
                    self.mpCardExpMonth(token.expiration_month);
                    self.mpCardExpYear(token.expiration_year);
                    self.mpCardNumber(formatNumber);

                    serviceUrl = urlBuilder.createUrl('/carts/mine/mp-create-vault', {});
                    payloadCreateVault = {
                        cartId: quoteId,
                        vaultData: {
                            token: self.mpCardNumberToken(),
                            identificationNumber: documentIdenfitication,
                            identificationType: documentType
                        }
                    };

                    $.ajax({
                        url: urlFormatter.build(serviceUrl),
                        data: JSON.stringify(payloadCreateVault),
                        global: true,
                        contentType: 'application/json',
                        type: 'POST',
                        async: false
                    }).done(
                        (response) => {
                            self.mpCardPublicId(response[0].card_id);
                            self.mpUserId(response[0].mp_user_id);
                            self.placeOrder();
                            fullScreenLoader.stopLoader();
                        }
                    ).fail(() => {
                        fullScreenLoader.stopLoader();
                    });
                }).catch((errors) => {

                    _.map(errors, (error) => {
                        self.displayErrorInField(error);
                    });

                    messageList.addErrorMessage({
                        message: $t('Unable to make payment, check card details.')
                    });
                    fullScreenLoader.stopLoader();
                });
            }

            if (!saveCard || !isUsed) {
                window.mp.fields.createCardToken(payload).then((token) => {
                    formatNumber = token.first_six_digits + 'xxxxxx' + token.last_four_digits;
                    self.mpCardNumberToken(token.id);
                    self.mpCardExpMonth(token.expiration_month);
                    self.mpCardExpYear(token.expiration_year);
                    self.mpCardNumber(formatNumber);
                    self.placeOrder();
                    fullScreenLoader.stopLoader();
                }).catch(() => {
                    messageList.addErrorMessage({
                        message: $t('Unable to make payment, check card details.')
                    });
                    fullScreenLoader.stopLoader();
                });
            }
        },

        /**
         * Get data
         * @returns {Object}
         */
        getData() {
            var self = this,
                data;

            data = {
                'method': this.getCode(),
                'additional_data': {
                    'payer_document_type': self.mpPayerType(),
                    'payer_document_identification': self.mpPayerDocument(),
                    'card_number_token': self.mpCardNumberToken(),
                    'card_holder_name': self.mpCardHolderName(),
                    'card_number': self.mpCardNumber(),
                    'card_exp_month': self.mpCardExpMonth(),
                    'card_exp_year': self.mpCardExpYear(),
                    'card_type': self.mpCardType(),
                    'card_installments': self.mpCardInstallment(),
                    'card_public_id': self.mpCardPublicId(),
                    'mp_user_id': self.mpUserId()
                }
            };

            data['additional_data'] = _.extend(data['additional_data'], this.additionalData);
            this.vaultEnabler.visitAdditionalData(data);
            return data;
        },

        /**
         * Formatted Currency to Installments
         * @param {Float} amount
         * @return {Boolean}
         */
        FormattedCurrencyToInstallments(amount) {
            if (this.getMpSiteId() === 'MCO') {
                return parseFloat(amount).toFixed(0);
            }
            return amount;
        },

        /**
         * Is show legend
         * @returns {Boolean}
         */
        isShowLegend() {
            return true;
        },

        /**
         * Get Cc Type
         * @returns {Object}
         */
        getCcType() {
            return window.checkoutConfig.payment[this.getCode()].ccTypesMapper;
        },

        /**
         * Get Unsupported Pre Auth
         * @returns {Object}
         */
        getUnsupportedPreAuth() {
            return window.checkoutConfig.payment[this.getCode()].unsupported_pre_auth;
        },

        /**
         * Get Vault Code
         * @returns {Boolean}
         */
        getVaultCode() {
            return window.checkoutConfig.payment[this.getCode()].ccVaultCode;
        },

        /**
         * Is Vault enabled
         * @returns {Boolean}
         */
        isVaultEnabled: function () {
            return this.vaultEnabler.isVaultEnabled();
        },

        /**
         * Progress bar update
         */
        updateProgress(valueInput){
            var progress = document.querySelector(".mp-progress-bar div");
            var total = this.amount();
            var porcent = (valueInput/total) * 100;
            
            progress.style.width = porcent + "%";
            document.getElementById("mp-message-error").style.display = "none";
  
            if(valueInput >= total){
                porcent = 0;
                progress.style.width = porcent + "%";
                document.getElementById("mp-message-error").style.display = "block";
            }

            if(valueInput < 0){
                porcent = 0;
                progress.style.width = porcent + "%";
            }
        },

        /**
         * Remaining value label update
         */
        updateRemainingAmount(){
            var amount = this.amount();
            var inputValueProgress = this.inputValueProgress();

            if(inputValueProgress < amount){
                amount = amount - inputValueProgress;
            }

            return priceUtils.formatPrice(amount);
        },
        /**
         * Input progress placeholder
         */
        placeholderInputProgress(){
            var amount = this.amount();
            amount = (amount/2);
            return priceUtils.formatPrice(amount);
        }

    });
});
